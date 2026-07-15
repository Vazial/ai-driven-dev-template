package reservation.adapter.api;

/** 拒否レスポンス(409/422)。契約(reservation-api.yaml ProblemResponse)に忠実。 */
public record ProblemResponse(String code, String message) {
}
