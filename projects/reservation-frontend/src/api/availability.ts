// GET /rooms/{roomId}/availability?date=YYYY-MM-DD 相当（reservation-api.yaml RSV-A追記、承認済み）。
// 実バックエンドは未実装のため、ここではモックデータを返す（RFE-Aスライス、meta/adr/0023）。
import type { ApiResult, AvailabilityResponse } from "./types";
import { MOCK_ROOMS, MOCK_RESERVATIONS } from "./mockData";
import { subtractRanges } from "./availabilityLogic";

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
  const room = MOCK_ROOMS.find((r) => r.roomId === roomId);
  if (!room) {
    return {
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "会議室が存在しません" },
    };
  }

  const busyRanges = MOCK_RESERVATIONS.filter(
    (r) => r.roomId === roomId && r.date === date,
  );
  const availableSlots = subtractRanges(
    room.businessHoursStart,
    room.businessHoursEnd,
    busyRanges,
  );

  return { ok: true, data: { roomId, date, availableSlots } };
}
