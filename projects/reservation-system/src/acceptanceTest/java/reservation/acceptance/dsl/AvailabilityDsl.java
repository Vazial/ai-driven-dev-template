package reservation.acceptance.dsl;

import static org.assertj.core.api.Assertions.assertThat;

import io.restassured.RestAssured;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

/**
 * RSV-A「空き枠を確認できる」専用の技術詳細(verification.md L4詳細(1)の第3層)。
 * ReservationSystemDslがcheckstyleのFileLength上限に達したための分離(RoomRulesDsl/RoomListDslと同じ経緯・
 * 同型。RSV-Lスライスの追加分を収めるため、既存のRSV-A部分を本ファイルへ切り出した)。
 * roomName→roomIdの解決(単一の源)はReservationSystemDsl側に集約したままで、このクラスは
 * ReservationSystemDslが持つ同じマップをコンストラクタで受け取って使う(RoomListDslと同型)。
 *
 * <p>スキーマ照合は既存のJsonSchemaAssertions(手写しスキーマ)を使う既存方式のままとした。本分離は
 * コードの移動のみを行い、検証方式(ADR-0007の全面適用の要否)は変更していない
 * (未着手の技術的宿題としてactiveContext.mdに記録済み)。
 */
final class AvailabilityDsl {

    private static final String NONEXISTENT_ROOM_ID_PREFIX = "does-not-exist-room-";

    private final String baseUrl;
    private final LocalDate baseDate;
    private final Map<String, String> roomIdByName;
    private String lastRoomId;
    private Response lastResponse;

    AvailabilityDsl(String baseUrl, LocalDate baseDate, Map<String, String> roomIdByName) {
        this.baseUrl = baseUrl;
        this.baseDate = baseDate;
        this.roomIdByName = roomIdByName;
    }

    /**
     * 会議室の空き枠を、共有の基準日について問い合わせる。会議室がGivenで用意されていない場合は
     * 実在しないIDで問い合わせる(RSV-A-07: 存在しない会議室の空き枠確認を、SUTの公開契約
     * (未知のID→404)通りに検証するため)。応答はReservationSystemDslにも返し、拒否検証で共有する。
     */
    Response checkAvailability(String roomName) {
        lastRoomId = roomIdByName.getOrDefault(roomName, NONEXISTENT_ROOM_ID_PREFIX + UUID.randomUUID());
        lastResponse = RestAssured.given().baseUri(baseUrl)
                .queryParam("date", baseDate.toString())
                .get("/rooms/%s/availability".formatted(lastRoomId));
        return lastResponse;
    }

    /** 空き枠確認が受理され(200)、空いている時間帯が指定した1件ちょうどであることを検証する。 */
    void assertAvailableSlots(String startTime, String endTime) {
        assertAvailableSlotsAre(List.of(new TimeSlot(startTime, endTime)));
    }

    /**
     * 空き枠確認が受理され(200)、空いている時間帯が指定した2件、その順序で
     * ちょうど返ることを検証する(reservation-api.yamlのAvailabilityResponseは開始時刻昇順が前提)。
     */
    void assertAvailableSlots(String firstStart, String firstEnd, String secondStart, String secondEnd) {
        assertAvailableSlotsAre(List.of(
                new TimeSlot(firstStart, firstEnd), new TimeSlot(secondStart, secondEnd)));
    }

    /** 空き枠確認が受理され(200)、空いている時間帯が一つもないことを検証する。 */
    void assertNoAvailableSlots() {
        assertAvailableSlotsAre(List.of());
    }

    /**
     * 空き枠確認の応答が、AvailabilityResponseのスキーマ(ADR-0007)に適合し、
     * 問い合わせたroomId・基準日、および期待した時間帯一覧(順序も含め)と一致することを検証する。
     */
    private void assertAvailableSlotsAre(List<TimeSlot> expectedSlots) {
        assertThat(lastResponse.statusCode())
                .as("空き枠確認の応答: %s", lastResponse.asString())
                .isEqualTo(200);
        JsonSchemaAssertions.assertMatchesSchema(
                "空き枠確認の応答", lastResponse.jsonPath().getMap(""), JsonSchemaAssertions.AVAILABILITY_RESPONSE_SCHEMA);
        JsonPath body = lastResponse.jsonPath();
        assertThat(body.getString("roomId")).as("応答のroomId").isEqualTo(lastRoomId);
        assertThat(body.getString("date")).as("応答のdate").isEqualTo(baseDate.toString());
        List<String> startTimes = body.getList("availableSlots.startTime", String.class);
        List<String> endTimes = body.getList("availableSlots.endTime", String.class);
        List<TimeSlot> actualSlots = IntStream.range(0, startTimes.size())
                .mapToObj(i -> new TimeSlot(startTimes.get(i), endTimes.get(i)))
                .toList();
        assertThat(actualSlots).as("空いている時間帯(順序を含め一致すること)").isEqualTo(expectedSlots);
    }

    private record TimeSlot(String startTime, String endTime) { }
}
