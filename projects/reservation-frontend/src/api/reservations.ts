// POST /reservations 相当（reservation-api.yaml、RSV-C「予約を作成できる」、承認済み 2026-07-13）。
// （RFE-Bスライス「空いている時間帯を予約できる」、contracts/reservation-booking.feature、
// meta/adr/0023「フロント先行・縦切り」）。
//
// 実バックエンド接続の3本目（`GET /rooms`＝adr/0009、`GET /rooms/{roomId}/availability`＝adr/0009
// 決定6(b) に続く）。既定はモック（`createMockReservation`）のまま、環境変数が実APIを指す場合だけ
// 実fetch（`postRealReservation`）に分岐する（ADR-0009 決定1のパターンを踏襲）。Vitest・通常の
// `npm run dev`・CIは環境変数を設定しないため、従来通りモックのみで完結する。
//
// **これが初めての「書き込み」の実接続である**（rooms・availability はいずれも読み取り）。読み取りとの
// 違いは、部分的な実接続が識別子空間ではなく**書き込み結果の可視性**を分断する点にある: モックの
// `createMockReservation` は MOCK_RESERVATIONS に push し、`getMockAvailability` がそれを読むため、
// RFE-B-02「予約がタイムラインに反映される」はこの共有状態で成立している。予約作成だけを実APIにすると、
// 作成した予約は実バックエンドに入りモック側のタイムラインには現れない。FR-007（rooms だけ実接続すると
// 実DBのUUIDとモックのroomIdが食い違う）と同型の失敗種であり、対処も同じ——**フラグは1本ずつ独立に
// 保ち**（ADR-0009 決定1）、「実用上は3つを同時に true にしないと画面が通しで機能しない」という
// 組み合わせの制約をコード上に明記する方式を踏襲する。
//
// 接続経路はVite dev serverのproxy。`POST /reservations` は既存の `/rooms` ルールの前方一致では
// **カバーされない**ため、vite.config.ts に `/reservations` ルールを新設した（越境なし＝CORSを足さない。
// ADR-0009 決定2・meta/adr/0023）。この配線は liveWiring.test.ts が機械ゲートする（meta/adr/0032）。
//
// このスライスの解釈ポイント(1)（contracts/reservation-booking.feature）: ドメインルールの再検証は
// せず、RSV-Cの各シナリオが定義する判定結果をそのまま再現する（実際の判定は reservationLogic.ts に
// 分離）。最終判定はAPI応答が持つ（reservation-frontend/adr/0001、ADR-0006の前提でもある）。
// 実APIモードでは判定そのものが実バックエンドに移り、reservationLogic.ts はモック専用になる。
import type {
  ApiResult,
  CancelledReservationResponse,
  CreateReservationInput,
  ProblemResponse,
  ReservationResponse,
} from "./types";
import { MOCK_ROOMS, MOCK_RESERVATIONS } from "./mockData";
import { findReservationRejection } from "./reservationLogic";
import { findCancellationRejection } from "./cancellationLogic";

let reservationSequence = 0;

// 環境変数はAPI単位でスコープする（ADR-0009 決定1の論拠を踏襲）。rooms・availability のフラグとは
// 独立に保つ（上記「書き込み結果の可視性」の注記を参照）。
const USE_REAL_RESERVATIONS_API =
  import.meta.env.VITE_USE_REAL_RESERVATIONS_API === "true";

/**
 * モックのバックエンドとして予約を作成する（アダプタの内側）。
 *
 * 成功(201相当): 予約が作成され、ReservationResponse を返す。
 * 拒否(409/422相当、ProblemResponse): 会議室が存在しない場合(ROOM_NOT_FOUND)、または
 * RSV-Cのドメインルールに反する場合(TIME_SLOT_CONFLICT・TOO_SHORT・INVALID_TIME_SLOT・
 * OUTSIDE_BUSINESS_HOURS・EXCEEDS_CAPACITY)。予約は作成されない。
 *
 * 成功時はMOCK_RESERVATIONS（src/api/mockData.ts）に予約を追加する。これにより、以後の
 * getRoomAvailability（RFE-A）の計算に反映される——RFE-B-02「タイムラインへの反映」はこの共有状態を
 * 通じて実現する。
 */
function createMockReservation(
  input: CreateReservationInput,
): ApiResult<ReservationResponse> {
  const room = MOCK_ROOMS.find((r) => r.roomId === input.roomId);
  if (!room) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "会議室が存在しません" },
    };
  }

  const existingOnSameRoomAndDate = MOCK_RESERVATIONS.filter(
    (r) => r.roomId === input.roomId && r.date === input.date,
  );

  const rejection = findReservationRejection(input, room, existingOnSameRoomAndDate);
  if (rejection) {
    return { ok: false, error: rejection };
  }

  reservationSequence += 1;
  const reservationId = `rsv-mock-${reservationSequence}`;

  MOCK_RESERVATIONS.push({
    reservationId,
    roomId: input.roomId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    reserverId: input.reserverId,
    attendeeCount: input.attendeeCount,
  });

  return {
    ok: true,
    data: {
      reservationId,
      roomId: input.roomId,
      reserverId: input.reserverId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      attendeeCount: input.attendeeCount,
    },
  };
}

// POST /reservations/{reservationId}/cancel 相当（reservation-api.yaml、RSV-K「予約をキャンセルできる」、
// 承認済み 2026-07-15）。RFE-Cスライス「自分の予約を確認してキャンセルできる」
// （contracts/my-reservations.feature、承認済み 2026-07-30）の対象。
//
// **このスライスの範囲はモック実装まで**。実バックエンド接続（4本目のopt-in）は別スライスであり、
// createReservation・getRoomAvailability のような `VITE_USE_REAL_*` 分岐は持たない
// （常にモックのcancelMockReservationを使う）。
//
// モックが「サーバ役」として判定するのは422 CANCEL_DEADLINE_PASSEDと409 ALREADY_CANCELLEDの2つ
// （契約解釈ポイント(2)(3)。本人以外403・存在しない予約404はこの画面に到達経路が無いため対象外）。
// 判定ロジック自体は cancellationLogic.ts に分離する（reservationLogic.ts と同じ位置づけ）。
//
// 現在時刻の扱い: `new Date()` は呼び出しの都度(cancelMockReservation の呼び出し時)評価する。
// モジュール読み込み時に一度だけ評価して固定しない——単体テストは `vi.setSystemTime`、E2Eは
// Playwright の `page.clock` でブラウザ時計を差し替えて検証するため、呼び出し時評価でないと
// どちらの経路からも時刻を制御できない。
/**
 * モックのバックエンドとして予約をキャンセルする（アダプタの内側）。
 *
 * 成功(200相当): 予約がキャンセルされ、CancelledReservationResponse を返す。MOCK_RESERVATIONS上の
 * 該当エントリに `cancelledAt` を立てる（論理削除。物理削除しない）。これにより以後の
 * getRoomAvailability（RFE-A/availability.ts）の計算からこの予約が外れ、時間帯が空きに戻る
 * （RFE-C-03の3つ目のThen）。
 *
 * 拒否(422/409相当、ProblemResponse): 開始15分前を過ぎている場合(CANCEL_DEADLINE_PASSED)、
 * または既にキャンセル済みの場合(ALREADY_CANCELLED)。
 *
 * 予約が見つからない場合はRESERVATION_NOT_FOUNDで拒否する。この経路は契約上定義されているが
 * （reservation-api.yaml 404）、このスライスのシナリオの対象外である（契約解釈ポイント(3)。
 * 一覧に現れる予約は必ずこの端末が成立させたものであり、通常の利用では到達しない）。
 */
function cancelMockReservation(
  reservationId: string,
): ApiResult<CancelledReservationResponse> {
  const reservation = MOCK_RESERVATIONS.find(
    (r) => r.reservationId === reservationId,
  );
  if (!reservation) {
    return {
      ok: false,
      error: { code: "RESERVATION_NOT_FOUND", message: "予約が存在しません" },
    };
  }

  const rejection = findCancellationRejection(reservation, new Date());
  if (rejection) {
    return { ok: false, error: rejection };
  }

  const cancelledAt = new Date().toISOString();
  reservation.cancelledAt = cancelledAt;

  return {
    ok: true,
    data: {
      reservationId: reservation.reservationId,
      roomId: reservation.roomId,
      reserverId: reservation.reserverId,
      date: reservation.date,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      attendeeCount: reservation.attendeeCount,
      cancelledAt,
    },
  };
}

/**
 * 予約をキャンセルする。
 *
 * このスライスはモック実装のみ（実バックエンド接続は別スライス）。呼び出し側（自分の予約一覧画面）
 * から見たシグネチャは、createReservation・getRoomAvailability と同様 Promise を返す非同期関数とし、
 * 将来実接続を追加する際に呼び出し側を変更せずに済むようにしておく。
 */
export async function cancelReservation(
  reservationId: string,
): Promise<ApiResult<CancelledReservationResponse>> {
  return cancelMockReservation(reservationId);
}

/**
 * 実バックエンドの `POST /reservations` を叩く（アダプタの内側）。
 *
 * 契約（reservation-api.yaml）が `POST /reservations` に定義する応答は3つだけ:
 *   - 201: ReservationResponse → `{ ok: true }`
 *   - 409: ProblemResponse（TIME_SLOT_CONFLICT）→ `{ ok: false }`
 *   - 422: ProblemResponse（TOO_SHORT・INVALID_TIME_SLOT・OUTSIDE_BUSINESS_HOURS・
 *          EXCEEDS_CAPACITY）→ `{ ok: false }`
 *
 * それ以外（契約が定義しない5xx等）・fetch自体の失敗（未起動・接続不可）は、ネットワーク層の失敗と
 * して扱い、`ProblemResponse` に押し込めず例外として呼び出し元へ伝播させる（ADR-0009 決定4）。
 *
 * **契約とモックの差（意図的に埋めない）**: 契約は `POST /reservations` に **404 を定義していない**。
 * 一方モックは存在しない会議室を ROOM_NOT_FOUND（ok:false）で拒否する。したがって実APIモードでは、
 * 存在しない会議室は「契約が定義しない応答」＝汎用の失敗（例外）になり、モードによって振る舞いが
 * 異なる。ここを埋めるには契約側に404を足す必要があり、それは契約変更＝人間承認の領分である
 * （ADR-0009 決定4が「契約が定義する応答だけを ApiResult に写す」と定めているため、実装側で勝手に
 * 404 を解釈しない）。画面は実バックエンドから取得した会議室しか一覧に出さないため、実運用でこの
 * 経路に入ることは想定されない。
 */
async function postRealReservation(
  input: CreateReservationInput,
): Promise<ApiResult<ReservationResponse>> {
  const response = await fetch("/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.ok) {
    return { ok: true, data: (await response.json()) as ReservationResponse };
  }
  if (response.status === 409 || response.status === 422) {
    return { ok: false, error: (await response.json()) as ProblemResponse };
  }
  throw new Error(`POST /reservations failed with status ${response.status}`);
}

/**
 * 予約を作成する。
 *
 * 既定はモック。`VITE_USE_REAL_RESERVATIONS_API=true` のときだけ実バックエンドを叩く
 * （ADR-0009 決定1のパターン）。呼び出し側から見た公開シグネチャはモード間で同一である。
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<ApiResult<ReservationResponse>> {
  return USE_REAL_RESERVATIONS_API
    ? postRealReservation(input)
    : createMockReservation(input);
}
