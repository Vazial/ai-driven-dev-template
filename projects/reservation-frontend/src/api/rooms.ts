// GET /rooms 相当（reservation-api.yaml RSV-L追記、承認済み）。
// 実バックエンドは未実装のため、ここではモックデータを返す（RFE-Aスライス、meta/adr/0023）。
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

/**
 * 会議室の一覧を取得する。
 * 契約の解釈ポイント(4)（reservation-api.yaml RSV-L追記）に合わせ、表示名(name)の
 * 昇順で返す。会議室が一件も無い場合は空配列を返す（このモックでは常に固定件数を返す）。
 */
export async function listRooms(): Promise<RoomSummary[]> {
  const response = fetchMockRoomListResponse();
  return response.rooms;
}
