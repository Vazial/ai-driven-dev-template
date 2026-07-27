package reservation.adapter.api;

/**
 * GET /rooms の200レスポンスの各要素。契約(reservation-api.yaml RoomSummary)に忠実。
 * minReservationDurationMinutes(最小予約時間)は含めない: システム共通の単一値を一覧要素ごとに
 * 複製すると二重管理のリスクを生むため、/rooms/{roomId}/rulesを正として一元化する(adr/0007)。
 */
public record RoomSummary(
        String roomId,
        String name,
        String businessHoursStart,
        String businessHoursEnd,
        int capacity) {
}
