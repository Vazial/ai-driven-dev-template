// POST /reservations 相当（reservation-api.yaml、RSV-C「予約を作成できる」、承認済み 2026-07-13）。
// 実バックエンドは未実装のため、ここではモックでRSV-Cのドメインルールを判定する
// （RFE-Bスライス「空いている時間帯を予約できる」、contracts/reservation-booking.feature、
// meta/adr/0023「フロント先行・縦切り」）。
//
// このスライスの解釈ポイント(1)（contracts/reservation-booking.feature）: ドメインルールの再検証は
// せず、RSV-Cの各シナリオが定義する判定結果をそのまま再現する（実際の判定は reservationLogic.ts に
// 分離）。最終判定はAPI応答が持つ（reservation-frontend/adr/0001、ADR-0006の前提でもある）。
//
// 成功時はMOCK_RESERVATIONS（src/api/mockData.ts）に予約を追加する。これにより、以後の
// getRoomAvailability（RFE-A）の計算に反映される——RFE-B-02「タイムラインへの反映」はこの共有状態を
// 通じて実現する。
import type { ApiResult, CreateReservationInput, ReservationResponse } from "./types";
import { MOCK_ROOMS, MOCK_RESERVATIONS } from "./mockData";
import { findReservationRejection } from "./reservationLogic";

let reservationSequence = 0;

/**
 * 予約を作成する。
 *
 * 成功(201相当): 予約が作成され、ReservationResponse を返す。
 * 拒否(409/422相当、ProblemResponse): 会議室が存在しない場合(ROOM_NOT_FOUND)、または
 * RSV-Cのドメインルールに反する場合(TIME_SLOT_CONFLICT・TOO_SHORT・INVALID_TIME_SLOT・
 * OUTSIDE_BUSINESS_HOURS・EXCEEDS_CAPACITY)。予約は作成されない。
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<ApiResult<ReservationResponse>> {
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
