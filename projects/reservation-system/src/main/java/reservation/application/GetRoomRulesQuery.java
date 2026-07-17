package reservation.application;

/**
 * 予約ルール確認の入力。契約(reservation-api.yaml)のGET /rooms/{roomId}/rules
 * (パスパラメータroomId)に対応する。
 */
public record GetRoomRulesQuery(String roomId) {
}
