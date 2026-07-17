package reservation.application;

import java.time.LocalTime;

/**
 * 予約ルール確認ユースケースの出力。契約(reservation-api.yaml RoomRulesResponse)の
 * roomIdを除く3点(営業時間・定員・最小予約時間)を保持する読み取り専用の組み立て結果
 * (design.md「主要な流れ(予約ルール確認)」)。roomIdはリクエストのパスパラメータを
 * そのまま使えるため、adapter/api側で付与する。
 */
public record RoomRules(
        LocalTime businessHoursStart,
        LocalTime businessHoursEnd,
        int capacity,
        int minReservationDurationMinutes) {
}
