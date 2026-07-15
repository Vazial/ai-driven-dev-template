package reservation.adapter.api;

/**
 * 201レスポンス。契約(reservation-api.yaml ReservationResponse)に忠実。
 * date/startTime/endTimeは契約の文字列表現(ISO日付・HH:mm)で返すためStringで持つ。
 */
public record ReservationResponse(
        String reservationId,
        String roomId,
        String reserverId,
        String date,
        String startTime,
        String endTime,
        int attendeeCount) {
}
