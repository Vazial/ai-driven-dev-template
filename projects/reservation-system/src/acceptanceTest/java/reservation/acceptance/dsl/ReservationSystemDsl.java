package reservation.acceptance.dsl;

import static org.assertj.core.api.Assertions.assertThat;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * 受け入れテストDSL(verification.md L4詳細(1)の第3層)。
 * 業務操作を業務の言葉のまま関数として提供し、HTTP等の技術詳細をこの層に閉じ込める。
 * SUTには公開API(POST /reservations)とGiven専用seam(/test-support/*)経由でのみ触れる。
 */
public class ReservationSystemDsl {

    public static final LocalDate FIXED_DATE_FOR_TIME_ONLY_SCENARIOS = LocalDate.of(2026, 7, 14);

    private static final String BASE_URL =
            System.getenv().getOrDefault("RESERVATION_API_BASE_URL", "http://localhost:8080");

    /** Givenの既存予約に使う予約者。シナリオが「誰の予約か」を指定しないことを名前で表す。 */
    private static final String UNSPECIFIED_EXISTING_RESERVER = "既存予約の持ち主";

    /** 「占有されている」の検証で、同じ時間帯の予約を試みて拒否されることを確かめる第三者。 */
    private static final String OCCUPANCY_PROBE_RESERVER = "占有確認プローブ";

    /** シナリオが人数を指定しない予約に使う、どの会議室でも定員内となる最小の人数。 */
    private static final int SMALLEST_VALID_ATTENDEE_COUNT = 1;

    /** 拒否理由の文言 → HTTPステータス+理由コード。出典: reservation-api.yaml冒頭の対応表。 */
    private static final Map<String, ExpectedRejection> REJECTION_BY_REASON = Map.of(
            "時間帯が既存の予約と重なっている", new ExpectedRejection(409, "TIME_SLOT_CONFLICT"),
            "予約は30分以上でなければならない", new ExpectedRejection(422, "TOO_SHORT"),
            "終了時刻は開始時刻より後でなければならない", new ExpectedRejection(422, "INVALID_TIME_SLOT"),
            "営業時間の外である", new ExpectedRejection(422, "OUTSIDE_BUSINESS_HOURS"),
            "人数が定員を超えている", new ExpectedRejection(422, "EXCEEDS_CAPACITY"));

    private final Map<String, String> roomIdByName = new HashMap<>();
    private ReservationRequest lastRequest;
    private Response lastResponse;

    // ---- 状態準備(Given) ----

    /** Given専用seamで全予約を削除し、シナリオ間の独立性を保つ。 */
    public void resetAllReservations() {
        Response res = RestAssured.given().baseUri(BASE_URL)
                .delete("/test-support/reservations");
        assertThat(res.statusCode())
                .as("予約全削除seamの応答: %s", res.asString())
                .isBetween(200, 299);
    }

    /** Given専用seamで会議室を用意する(同名は上書き)。応答のroomIdを以後の予約操作に使う。 */
    public void ensureRoomExists(String roomName, String opensAt, String closesAt, int capacity) {
        Response res = RestAssured.given().baseUri(BASE_URL).contentType(ContentType.JSON)
                .body("""
                        {"name": "%s", "businessHoursStart": "%s", "businessHoursEnd": "%s", "capacity": %d}"""
                        .formatted(roomName, opensAt, closesAt, capacity))
                .post("/test-support/rooms");
        assertThat(res.statusCode())
                .as("会議室セットアップseamの応答: %s", res.asString())
                .isBetween(200, 299);
        String roomId = res.jsonPath().getString("roomId");
        assertThat(roomId).as("会議室セットアップseam応答のroomId").isNotBlank();
        roomIdByName.put(roomName, roomId);
    }

    /** 前提となる既存予約を公開API経由で作成する。作成できなければ前提が壊れているため即失敗させる。 */
    public void givenReservationExists(String roomName, String startTime, String endTime) {
        Response res = postReservation(new ReservationRequest(
                roomIdOf(roomName), reserverIdOf(UNSPECIFIED_EXISTING_RESERVER),
                FIXED_DATE_FOR_TIME_ONLY_SCENARIOS, startTime, endTime, SMALLEST_VALID_ATTENDEE_COUNT));
        assertThat(res.statusCode())
                .as("前提とする既存予約の作成: %s", res.asString())
                .isEqualTo(201);
    }

    // ---- 業務操作(When) ----

    /** 予約を試みる。成否の検証はThen側のassertメソッドが行う。 */
    public void reserve(String reserverName, String roomName,
            String startTime, String endTime, int attendeeCount) {
        lastRequest = new ReservationRequest(roomIdOf(roomName), reserverIdOf(reserverName),
                FIXED_DATE_FOR_TIME_ONLY_SCENARIOS, startTime, endTime, attendeeCount);
        lastResponse = postReservation(lastRequest);
    }

    // ---- 検証(Then) ----

    /** 直前の予約操作が受理され(201)、依頼した内容の予約として返ったことを検証する。 */
    public void assertReservationCreated() {
        assertThat(lastResponse.statusCode())
                .as("予約作成の応答: %s", lastResponse.asString())
                .isEqualTo(201);
        JsonPath body = lastResponse.jsonPath();
        assertThat(body.getString("reservationId")).as("予約ID").isNotBlank();
        assertThat(body.getString("roomId")).isEqualTo(lastRequest.roomId());
        assertThat(body.getString("reserverId")).isEqualTo(lastRequest.reserverId());
        assertThat(body.getString("date")).isEqualTo(lastRequest.date().toString());
        assertThat(body.getString("startTime")).isEqualTo(lastRequest.startTime());
        assertThat(body.getString("endTime")).isEqualTo(lastRequest.endTime());
        assertThat(body.getInt("attendeeCount")).isEqualTo(lastRequest.attendeeCount());
    }

    /** 直前の予約操作が、契約の対応表通りのHTTPステータス+理由コードで拒否されたことを検証する。 */
    public void assertReservationRejected(String reasonText) {
        ExpectedRejection expected = REJECTION_BY_REASON.get(reasonText);
        assertThat(expected)
                .as("契約(reservation-api.yaml)の対応表にない拒否理由の文言: %s", reasonText)
                .isNotNull();
        assertThat(lastResponse.statusCode())
                .as("拒否応答: %s", lastResponse.asString())
                .isEqualTo(expected.httpStatus());
        assertThat(lastResponse.jsonPath().getString("code")).isEqualTo(expected.code());
        assertThat(lastResponse.jsonPath().getString("message")).as("人間が読める説明").isNotBlank();
    }

    /**
     * 「占有されている」を公開境界だけで観測する:
     * (1) 直前に作成された予約が、その予約者・その会議室・その時間帯のものである
     * (2) 第三者が同じ時間帯を予約しようとすると、重なりを理由に拒否される
     */
    public void assertSlotOccupiedBy(String roomName, String startTime, String endTime, String reserverName) {
        assertThat(lastResponse.statusCode())
                .as("占有の根拠となる予約作成の応答: %s", lastResponse.asString())
                .isEqualTo(201);
        JsonPath created = lastResponse.jsonPath();
        assertThat(created.getString("reserverId")).as("占有している予約者").isEqualTo(reserverIdOf(reserverName));
        assertThat(created.getString("roomId")).as("占有されている会議室").isEqualTo(roomIdOf(roomName));
        assertThat(created.getString("date")).isEqualTo(FIXED_DATE_FOR_TIME_ONLY_SCENARIOS.toString());
        assertThat(created.getString("startTime")).isEqualTo(startTime);
        assertThat(created.getString("endTime")).isEqualTo(endTime);
        Response probe = postReservation(new ReservationRequest(
                roomIdOf(roomName), reserverIdOf(OCCUPANCY_PROBE_RESERVER),
                FIXED_DATE_FOR_TIME_ONLY_SCENARIOS, startTime, endTime, SMALLEST_VALID_ATTENDEE_COUNT));
        assertThat(probe.statusCode())
                .as("占有中の時間帯への第三者の予約試行: %s", probe.asString())
                .isEqualTo(409);
        assertThat(probe.jsonPath().getString("code")).isEqualTo("TIME_SLOT_CONFLICT");
    }

    // ---- 技術詳細(この層に閉じ込める) ----

    private String roomIdOf(String roomName) {
        String roomId = roomIdByName.get(roomName);
        assertThat(roomId).as("会議室'%s'はGivenで用意されていなければならない", roomName).isNotBlank();
        return roomId;
    }

    /** シナリオでは予約者は名前で登場する。SUTにはIDが必要なため、名前から決定的に導出する。 */
    private static String reserverIdOf(String reserverName) {
        return "user-" + reserverName;
    }

    private static Response postReservation(ReservationRequest request) {
        return RestAssured.given().baseUri(BASE_URL).contentType(ContentType.JSON)
                .body("""
                        {"roomId": "%s", "reserverId": "%s", "date": "%s",
                         "startTime": "%s", "endTime": "%s", "attendeeCount": %d}"""
                        .formatted(request.roomId(), request.reserverId(), request.date(),
                                request.startTime(), request.endTime(), request.attendeeCount()))
                .post("/reservations");
    }

    private record ReservationRequest(String roomId, String reserverId, LocalDate date,
            String startTime, String endTime, int attendeeCount) {
    }

    private record ExpectedRejection(int httpStatus, String code) {
    }
}
