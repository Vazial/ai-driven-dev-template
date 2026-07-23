// GET /rooms 相当（reservation-api.yaml RSV-L追記、API形状はドラフト・人間承認待ち）。
// 実バックエンドは未実装のため、ここではモックデータを返す（RFE-Aスライス、meta/adr/0023）。
import type { RoomSummary } from "./types";
import { MOCK_ROOMS } from "./mockData";

/**
 * 会議室の一覧を取得する。
 * ドラフト契約の解釈ポイント(4)（reservation-api.yaml RSV-L追記）に合わせ、表示名(name)の
 * 昇順で返す。会議室が一件も無い場合は空配列を返す（このモックでは常に固定件数を返す）。
 */
export async function listRooms(): Promise<RoomSummary[]> {
  return [...MOCK_ROOMS].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}
