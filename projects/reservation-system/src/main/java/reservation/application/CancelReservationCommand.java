package reservation.application;

/**
 * 予約キャンセルの入力。契約(reservation-api.yaml)のCancelReservationRequest+パスパラメータに対応する。
 */
public record CancelReservationCommand(String reservationId, String requesterId) {
}
