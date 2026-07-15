package reservation.adapter.api;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * POST /reservations のリクエスト。契約(reservation-api.yaml CreateReservationRequest)に忠実。
 * 時刻はHH:mm形式(契約のpattern)。形式違反・必須欠落はSpring既定の400(契約の対象外領域)。
 */
public record CreateReservationRequest(
        @NotBlank String roomId,
        @NotBlank String reserverId,
        @NotNull LocalDate date,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime startTime,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime endTime,
        @NotNull @Min(1) Integer attendeeCount) {
}
