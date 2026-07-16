package reservation.adapter.api;

import java.util.List;

/**
 * GET /rooms/{roomId}/availability の200レスポンス。契約(reservation-api.yaml AvailabilityResponse)に忠実。
 * availableSlotsは開始時刻の昇順(契約のdescription)。予約が一件もない日は営業時間そのもの1件、
 * 全て埋まっている日は空配列になる。
 */
public record AvailabilityResponse(String roomId, String date, List<AvailableTimeSlot> availableSlots) {
}
