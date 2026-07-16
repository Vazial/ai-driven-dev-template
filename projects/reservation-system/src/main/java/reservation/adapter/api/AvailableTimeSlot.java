package reservation.adapter.api;

/**
 * 空いている時間帯1件。契約(reservation-api.yaml AvailableTimeSlot)に忠実。
 * startTime/endTimeは契約の文字列表現(HH:mm)で返すためStringで持つ。
 */
public record AvailableTimeSlot(String startTime, String endTime) {
}
