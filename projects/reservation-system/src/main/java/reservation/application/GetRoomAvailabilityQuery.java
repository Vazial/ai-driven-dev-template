package reservation.application;

import java.time.LocalDate;

/**
 * 空き枠確認の入力。契約(reservation-api.yaml)のGET /rooms/{roomId}/availability
 * (パスパラメータroomId + クエリパラメータdate)に対応する。
 */
public record GetRoomAvailabilityQuery(String roomId, LocalDate date) {
}
