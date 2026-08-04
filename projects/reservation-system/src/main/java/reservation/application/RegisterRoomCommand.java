package reservation.application;

import java.time.LocalTime;

/**
 * 会議室登録の入力。契約(reservation-api.yaml)のRoomRegistrationRequestに対応する。
 */
public record RegisterRoomCommand(
        String name,
        LocalTime businessHoursStart,
        LocalTime businessHoursEnd,
        int capacity) {
}
