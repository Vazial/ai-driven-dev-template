package reservation.adapter.api;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

/**
 * POST /rooms のリクエスト。契約(reservation-api.yaml RoomRegistrationRequest)に忠実。
 * 時刻はHH:mm形式(契約のpattern)。形式違反・必須欠落はSpring既定の400(契約の対象外領域)。
 * 定員の下限(1人以上)はスキーマの制約(minimum: 1)のみで表現し、業務ルールの拒否理由コードは
 * 持たせない(adr/0008決定5)。
 */
public record RoomRegistrationRequest(
        @NotBlank String name,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime businessHoursStart,
        @NotNull @JsonFormat(pattern = "HH:mm") LocalTime businessHoursEnd,
        @NotNull @Min(1) Integer capacity) {
}
