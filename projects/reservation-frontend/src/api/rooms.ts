// GET /rooms 相当（reservation-api.yaml RSV-L追記、承認済み）。
//
// 実バックエンド接続の初適用（reservation-frontend/adr/0009、人間承認 2026-07-28）。
// 既定はモック（`fetchMockRoomListResponse`）のまま、環境変数が実APIを指す場合だけ実fetch
// （`fetchRealRoomListResponse`）に分岐する（ADR-0009 決定1）。Vitest・通常の`npm run dev`・
// CIは環境変数を設定しないため、従来通りモックのみで完結する。
//
// yamlのレスポンス形状は `RoomListResponse = { rooms: RoomSummary[] }` というオブジェクトの
// ラッパーである（design/reconciliation/rsv-l-room-list-ssot-reconciliation.md 2節の裁定）。
// `listRooms()` の公開シグネチャ（呼び出し側が期待する `Promise<RoomSummary[]>`）は変えず、
// この関数の内部だけがラッパーを組み立てて `.rooms` を剥離するアダプタになる。
import type { RoomListResponse, RoomSummary } from "./types";
import { MOCK_ROOMS } from "./mockData";

/** モックのバックエンドが返す `RoomListResponse` 相当を組み立てる（アダプタの内側） */
function fetchMockRoomListResponse(): RoomListResponse {
  return {
    rooms: [...MOCK_ROOMS].sort((a, b) => a.name.localeCompare(b.name, "ja")),
  };
}

// 環境変数の設計（ADR-0009 決定1・2、developer裁量）: 真偽値フラグ + 固定の相対パスを採用した
// （baseURLを持たせる設計は不採用）。理由: 接続経路はVite dev serverのproxy
// （vite.config.tsのserver.proxy、決定2）であり、ブラウザからは同一オリジンの相対パス
// `/rooms` を叩けば良い。baseURLを持たせる設計は「別オリジンへ直接アクセスする」ことを暗黙の
// 前提にしてしまい、「バックエンド（CORS）は変更しない」という決定2の前提と噛み合わない。
// 変数名を`VITE_USE_REAL_ROOMS_API`とAPI単位にスコープした理由: 本ADRの接続対象は`GET /rooms`
// 1本のみであり（決定6が「2本目のAPIを実接続する時」を別条件として明示している）、汎用的な
// `VITE_USE_REAL_API`のような名前にすると将来2本目を足す際に同じ変数を使い回してしまい、
// 「1本ずつ独立にopt-inする」というスコープの狭さが読み取れなくなるため。
const USE_REAL_ROOMS_API = import.meta.env.VITE_USE_REAL_ROOMS_API === "true";

/**
 * 実バックエンドの`GET /rooms`を叩き、`RoomListResponse`を取得する（アダプタの内側）。
 * ネットワーク層の失敗（未起動・接続不可等）・非200応答は、ここでは`ProblemResponse`に
 * 押し込めず例外として呼び出し元へ伝播させる（reject）。`ApiResult<T>`は拡張しない
 * （ADR-0009 決定4）。画面側（AvailabilityScreen）が最小限の汎用失敗表示を出す。
 */
async function fetchRealRoomListResponse(): Promise<RoomListResponse> {
  const response = await fetch("/rooms");
  if (!response.ok) {
    throw new Error(`GET /rooms failed with status ${response.status}`);
  }
  return (await response.json()) as RoomListResponse;
}

/**
 * 会議室の一覧を取得する。
 * 契約の解釈ポイント(4)（reservation-api.yaml RSV-L追記）に合わせ、表示名(name)の
 * 昇順で返す。会議室が一件も無い場合は空配列を返す（このモックでは常に固定件数を返す）。
 * 実APIモード（`VITE_USE_REAL_ROOMS_API=true`）では、ソート済みで返すかはバックエンドの
 * 実装次第だが、既存のモック契約解釈（昇順ソート）はモック側の振る舞いとして維持する。
 */
export async function listRooms(): Promise<RoomSummary[]> {
  const response = USE_REAL_ROOMS_API
    ? await fetchRealRoomListResponse()
    : fetchMockRoomListResponse();
  return response.rooms;
}
