package reservation.adapter.api;

/**
 * 200レスポンス。契約(reservation-api.yaml CancelledReservationResponse)に忠実。
 * date/startTime/endTimeは契約の文字列表現(ISO日付・HH:mm)、cancelledAtはオフセット付きISO日時で返す。
 */
public record CancelledReservationResponse(
        String reservationId,
        String roomId,
        String reserverId,
        String date,
        String startTime,
        String endTime,
        int attendeeCount,
        String cancelledAt) {
}
