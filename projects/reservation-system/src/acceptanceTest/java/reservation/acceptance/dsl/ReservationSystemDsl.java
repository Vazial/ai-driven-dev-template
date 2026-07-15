package reservation.acceptance.dsl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 受け入れテストDSL(verification.md L4詳細(1)の第3層)。
 * 業務操作を業務の言葉のまま関数として提供し、HTTP等の技術詳細をこの層に閉じ込める。
 * SUTには公開API(POST /reservations、POST /reservations/{id}/cancel)と
 * Given専用seam(/test-support/*)経由でのみ触れる。
 * スライスRSV-C(作成)とRSV-K(キャンセル)の両方が同じインスタンスを共有する
 * (理由はReservationCreateStepsのクラスコメントを参照)。
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
            "人数が定員を超えている", new ExpectedRejection(422, "EXCEEDS_CAPACITY"),
            "予約した本人ではない", new ExpectedRejection(403, "NOT_RESERVER"),
            "開始15分前を過ぎている", new ExpectedRejection(422, "CANCEL_DEADLINE_PASSED"),
            "既にキャンセルされている", new ExpectedRejection(409, "ALREADY_CANCELLED"),
            "予約が存在しない", new ExpectedRejection(404, "RESERVATION_NOT_FOUND"));

    /** 「記録された予約が無い」ことをキャンセルAPIに問い合わせて確認するための、実在しないID。 */
    private static final String NONEXISTENT_RESERVATION_ID_PREFIX = "does-not-exist-";

    /**
     * 「現在時刻は…」Givenを持たないシナリオが使う既定の現在時刻。
     * 会議室の営業開始時刻(09:00)であり、シナリオが作る予約(最速10:00開始)より
     * 常に15分以上前になるため、キャンセル期限切れに巻き込まれない中立な基準点として選ぶ。
     */
    private static final String BASE_DATE_DEFAULT_TIME_OF_DAY = "09:00";

    private final Map<String, String> roomIdByName = new HashMap<>();
    /** Givenで作られた予約のID。キーは会議室名+時間帯("会議室名|開始|終了")。RSV-Kのキャンセル操作が引く。 */
    private final Map<String, String> reservationIdByRoomAndSlot = new HashMap<>();
    private ReservationRequest lastRequest;
    private Response lastResponse;
    private CancelRequest lastCancelRequest;

    // ---- 状態準備(Given) ----

    /** Given専用seamで全予約を削除し、シナリオ間の独立性を保つ。 */
    public void resetAllReservations() {
        Response res = RestAssured.given().baseUri(BASE_URL)
                .delete("/test-support/reservations");
        assertThat(res.statusCode())
                .as("予約全削除seamの応答: %s", res.asString())
                .isBetween(200, 299);
    }

    /**
     * 現在時刻を基準日(FIXED_DATE_FOR_TIME_ONLY_SCENARIOS)の既定時刻に固定する。
     * DELETE /test-support/reservationsが現在時刻を実時刻へ戻す仕様のため、
     * その直後(フック)で呼び、シナリオが「現在時刻は…」を明示しない限り
     * 実時刻ずれの影響を受けない決定論的な状態にする。
     */
    public void fixCurrentTimeToBaseDate() {
        setCurrentTime(BASE_DATE_DEFAULT_TIME_OF_DAY);
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

    /**
     * 予約者を明示した前提予約を公開API経由で作成する(RSV-K: キャンセルは本人特定が要るため持ち主を明示する)。
     * 作成できなければ前提が壊れているため即失敗させ、以後のキャンセル操作がIDを引けるよう記憶する。
     */
    public void givenOwnedReservationExists(String roomName, String reserverName, String startTime, String endTime) {
        Response res = postReservation(new ReservationRequest(
                roomIdOf(roomName), reserverIdOf(reserverName),
                FIXED_DATE_FOR_TIME_ONLY_SCENARIOS, startTime, endTime, SMALLEST_VALID_ATTENDEE_COUNT));
        assertThat(res.statusCode())
                .as("前提となる持ち主付き予約の作成: %s", res.asString())
                .isEqualTo(201);
        reservationIdByRoomAndSlot.put(reservationSlotKey(roomName, startTime, endTime),
                res.jsonPath().getString("reservationId"));
    }

    /**
     * 現在時刻を固定する(Given専用seam)。基準日はFIXED_DATE_FOR_TIME_ONLY_SCENARIOSと共有する。
     * seamの仕様上、オフセットなしのローカル日時で送る(サーバのタイムゾーンで解釈される)。
     */
    public void setCurrentTime(String timeOfDay) {
        String isoDateTime = FIXED_DATE_FOR_TIME_ONLY_SCENARIOS + "T" + timeOfDay + ":00";
        Response res = RestAssured.given().baseUri(BASE_URL).contentType(ContentType.JSON)
                .body("""
                        {"now": "%s"}""".formatted(isoDateTime))
                .put("/test-support/clock");
        assertThat(res.statusCode())
                .as("時刻固定seamの応答: %s", res.asString())
                .isBetween(200, 299);
    }

    /** 前提として、指定の予約が既にキャンセル済みであることを公開API経由で作る。実行できなければ前提が壊れている。 */
    public void givenReservationAlreadyCancelled(String reserverName, String roomName,
            String startTime, String endTime) {
        Response res = postCancel(reservationIdFor(roomName, startTime, endTime), reserverName);
        assertThat(res.statusCode())
                .as("前提となる予約キャンセルの実行: %s", res.asString())
                .isEqualTo(200);
    }

    // ---- 業務操作(When) ----

    /** 予約を試みる。成否の検証はThen側のassertメソッドが行う。 */
    public void reserve(String reserverName, String roomName,
            String startTime, String endTime, int attendeeCount) {
        lastRequest = new ReservationRequest(roomIdOf(roomName), reserverIdOf(reserverName),
                FIXED_DATE_FOR_TIME_ONLY_SCENARIOS, startTime, endTime, attendeeCount);
        lastResponse = postReservation(lastRequest);
    }

    /** 予約のキャンセルを試みる。成否の検証はThen側のassertメソッドが行う。 */
    public void cancelReservation(String reserverName, String roomName, String startTime, String endTime) {
        String reservationId = reservationIdFor(roomName, startTime, endTime);
        // Givenで作る予約(givenOwnedReservationExists)は必ずSMALLEST_VALID_ATTENDEE_COUNTで作られるため、
        // キャンセル成功時に返るattendeeCountの期待値もそれで固定できる。
        lastCancelRequest = new CancelRequest(reservationId, roomName, reserverName,
                startTime, endTime, SMALLEST_VALID_ATTENDEE_COUNT);
        lastResponse = postCancel(reservationId, reserverName);
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

    /**
     * 直前のキャンセル操作が受理され(200)、CancelledReservationResponseのrequired 8フィールド
     * (reservationId・roomId・reserverId・date・startTime・endTime・attendeeCount・cancelledAt)
     * が依頼内容+キャンセル対象の予約内容と一致することを検証する。
     * cancelledAtのみ値そのものは予測できないため、非空+ISO日時として妥当な形式であることを確認する。
     */
    public void assertReservationCancelled() {
        assertThat(lastResponse.statusCode())
                .as("予約キャンセルの応答: %s", lastResponse.asString())
                .isEqualTo(200);
        JsonPath body = lastResponse.jsonPath();
        assertThat(body.getString("reservationId")).as("予約ID").isEqualTo(lastCancelRequest.reservationId());
        assertThat(body.getString("roomId")).isEqualTo(roomIdOf(lastCancelRequest.roomName()));
        assertThat(body.getString("reserverId")).isEqualTo(reserverIdOf(lastCancelRequest.reserverName()));
        assertThat(body.getString("date")).isEqualTo(FIXED_DATE_FOR_TIME_ONLY_SCENARIOS.toString());
        assertThat(body.getString("startTime")).isEqualTo(lastCancelRequest.startTime());
        assertThat(body.getString("endTime")).isEqualTo(lastCancelRequest.endTime());
        assertThat(body.getInt("attendeeCount")).isEqualTo(lastCancelRequest.attendeeCount());
        String cancelledAt = body.getString("cancelledAt");
        assertThat(cancelledAt).as("キャンセルが実行された日時").isNotBlank();
        assertThatCode(() -> DateTimeFormatter.ISO_DATE_TIME.parse(cancelledAt))
                .as("キャンセルが実行された日時の形式(ISO日時): %s", cancelledAt)
                .doesNotThrowAnyException();
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

    /**
     * 会議室名+時間帯からGivenで記憶したreservationIdを引く。
     * 記憶がなければ(=このシナリオでその予約を作っていない)、実在しないIDを返す。
     * RSV-K-09「存在しない予約はキャンセルできない」を、SUTの公開契約(未知のID→404)通りに
     * 検証するための、あいまいさのない一意な設計(対応する予約が無いことをSUTに直接問い合わせる)。
     */
    private String reservationIdFor(String roomName, String startTime, String endTime) {
        return reservationIdByRoomAndSlot.getOrDefault(
                reservationSlotKey(roomName, startTime, endTime),
                NONEXISTENT_RESERVATION_ID_PREFIX + UUID.randomUUID());
    }

    /** 解決済みのreservationIdへ予約キャンセルを送る。 */
    private Response postCancel(String reservationId, String reserverName) {
        return RestAssured.given().baseUri(BASE_URL).contentType(ContentType.JSON)
                .body("""
                        {"reserverId": "%s"}""".formatted(reserverIdOf(reserverName)))
                .post("/reservations/%s/cancel".formatted(reservationId));
    }

    private static String reservationSlotKey(String roomName, String startTime, String endTime) {
        return roomName + "|" + startTime + "|" + endTime;
    }

    private record ReservationRequest(String roomId, String reserverId, LocalDate date,
            String startTime, String endTime, int attendeeCount) {
    }

    private record CancelRequest(String reservationId, String roomName, String reserverName,
            String startTime, String endTime, int attendeeCount) {
    }

    private record ExpectedRejection(int httpStatus, String code) {
    }
}
