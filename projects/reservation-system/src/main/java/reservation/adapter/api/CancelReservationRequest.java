package reservation.adapter.api;

import jakarta.validation.constraints.NotBlank;

/**
 * POST /reservations/{reservationId}/cancel のリクエスト。
 * 契約(reservation-api.yaml CancelReservationRequest)に忠実。
 */
public record CancelReservationRequest(@NotBlank String reserverId) {
}
