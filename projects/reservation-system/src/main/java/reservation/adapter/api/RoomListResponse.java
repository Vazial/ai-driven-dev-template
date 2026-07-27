package reservation.adapter.api;

import java.util.List;

/**
 * GET /rooms の200レスポンス。契約(reservation-api.yaml RoomListResponse)に忠実。
 * roomsはname(表示名)の昇順(RoomListServiceが整列済み)。会議室が一件も登録されていない場合は
 * 空配列(RSV-L-02。404にはしない)。
 */
public record RoomListResponse(List<RoomSummary> rooms) {
}
