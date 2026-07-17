package reservation.adapter.api;

/**
 * GET /rooms/{roomId}/rules の200レスポンス。契約(reservation-api.yaml RoomRulesResponse)に忠実。
 * businessHoursStart/Endは会議室ごとの現在の設定、minReservationDurationMinutesはシステム共通の値
 * (RSV-C-05/RSV-A-05のルールと同一箇所)。
 */
public record RoomRulesResponse(
        String roomId,
        String businessHoursStart,
        String businessHoursEnd,
        int capacity,
        int minReservationDurationMinutes) {
}
