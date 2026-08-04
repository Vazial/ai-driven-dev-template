// GET /rooms/{roomId}/availability?date=YYYY-MM-DD 相当（reservation-api.yaml RSV-A追記、承認済み）。
//
// 実バックエンド接続の2本目（reservation-frontend/adr/0009 決定6(b)。`GET /rooms` に続く）。
// 既定はモック（`getMockAvailability`）のまま、環境変数が実APIを指す場合だけ実fetch
// （`fetchRealAvailability`）に分岐する（ADR-0009 決定1のパターンを踏襲）。Vitest・通常の
// `npm run dev`・CIは環境変数を設定しないため、従来通りモックのみで完結する。
//
// 接続経路はVite dev serverのproxy（vite.config.tsの `/rooms` ルール）。このルールは前方一致で
// `/rooms/{roomId}/availability` も同一オリジンに見せるため、availability専用のproxy追加は不要
// （越境なし＝CORSを足さない。ADR-0009 決定2・meta/adr/0023）。
import type { ApiResult, AvailabilityResponse, ProblemResponse } from "./types";
import { MOCK_ROOMS, MOCK_RESERVATIONS } from "./mockData";
import { subtractRanges } from "./availabilityLogic";

// 環境変数はAPI単位でスコープする（ADR-0009 決定1の論拠を踏襲）。`GET /rooms` の
// `VITE_USE_REAL_ROOMS_API` とは独立のフラグにし、「1本ずつ独立にopt-inする」スコープの狭さを
// 変数名に残す。実用上はroomsとavailabilityを同時にtrueにしないと画面が機能しない（FR-007。実DBの
// UUIDとモックのroomIdが食い違うため）が、フラグ自体は独立に保つ。
const USE_REAL_AVAILABILITY_API =
  import.meta.env.VITE_USE_REAL_AVAILABILITY_API === "true";

/**
 * モックのバックエンドとして空き時間帯を計算する（アダプタの内側）。
 * 成功: availableSlots を返す。会議室が存在しなければ ROOM_NOT_FOUND で拒否する。
 */
function getMockAvailability(
  roomId: string,
  date: string,
): ApiResult<AvailabilityResponse> {
  const room = MOCK_ROOMS.find((r) => r.roomId === roomId);
  if (!room) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "会議室が存在しません" },
    };
  }

  // キャンセルされた予約（cancelledAtが立っているもの、RFE-C）は占有として扱わない——
  // キャンセルされた時間帯は空きに戻る（RFE-C-03の3つ目のThen、reservation-system側RSV-K-03と同型）。
  const busyRanges = MOCK_RESERVATIONS.filter(
    (r) => r.roomId === roomId && r.date === date && !r.cancelledAt,
  );
  const availableSlots = subtractRanges(
    room.businessHoursStart,
    room.businessHoursEnd,
    busyRanges,
  );

  return { ok: true, data: { roomId, date, availableSlots } };
}

/**
 * 実バックエンドの `GET /rooms/{roomId}/availability?date=` を叩く（アダプタの内側）。
 *
 * 契約（reservation-api.yaml）が定義する応答は2つだけ:
 *   - 200: AvailabilityResponse → `{ ok: true }`
 *   - 404: ProblemResponse（ROOM_NOT_FOUND）→ `{ ok: false }`（サーバが応答した契約形状の拒否）
 *
 * それ以外（契約が定義しない5xx等）・fetch自体の失敗（未起動・接続不可）は、ネットワーク層の失敗
 * として扱い、`ProblemResponse` に押し込めず例外として呼び出し元へ伝播させる（ADR-0009 決定4）。
 * 画面側（AvailabilityScreen）が最小限の汎用失敗表示を出す。
 */
async function fetchRealAvailability(
  roomId: string,
  date: string,
): Promise<ApiResult<AvailabilityResponse>> {
  const response = await fetch(
    `/rooms/${encodeURIComponent(roomId)}/availability?date=${encodeURIComponent(date)}`,
  );
  if (response.ok) {
    return { ok: true, data: (await response.json()) as AvailabilityResponse };
  }
  if (response.status === 404) {
    return { ok: false, error: (await response.json()) as ProblemResponse };
  }
  throw new Error(
    `GET /rooms/${roomId}/availability failed with status ${response.status}`,
  );
}

/**
 * 指定した会議室・日付の空き時間帯を取得する。
 *
 * 成功(200相当): AvailabilityResponse.availableSlots を返す。
 * 拒否(404相当、ROOM_NOT_FOUND): 会議室が存在しない場合。
 *
 * このスライスでは案B（reservation-frontend/adr/0006）に基づき、占有情報・予約者情報は一切
 * 扱わない。availableSlots（空き時間帯）のみを計算・返却する。
 */
export async function getRoomAvailability(
  roomId: string,
  date: string,
): Promise<ApiResult<AvailabilityResponse>> {
  return USE_REAL_AVAILABILITY_API
    ? fetchRealAvailability(roomId, date)
    : getMockAvailability(roomId, date);
}
