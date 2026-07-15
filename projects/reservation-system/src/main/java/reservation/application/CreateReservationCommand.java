package reservation.application;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * 予約作成の入力。契約(reservation-api.yaml)のCreateReservationRequestに対応する。
 */
public record CreateReservationCommand(
        String roomId,
        String reserverId,
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        int attendeeCount) {
}
