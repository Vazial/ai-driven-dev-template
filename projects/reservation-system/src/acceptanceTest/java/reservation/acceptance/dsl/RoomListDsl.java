package reservation.acceptance.dsl;

import static org.assertj.core.api.Assertions.assertThat;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.model.Request;
import com.atlassian.oai.validator.report.ValidationReport;
import com.atlassian.oai.validator.restassured.RestAssuredResponse;
import io.restassured.RestAssured;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import java.util.List;
import java.util.Map;

/**
 * RSV-L「会議室の一覧を確認できる」専用の技術詳細(verification.md L4詳細(1)の第3層)。
 * ReservationSystemDslがcheckstyleのFileLength上限に達したための分離(RoomRulesDslと同じ経緯・同型)。
 * roomName→roomIdの解決(単一の源)はReservationSystemDsl側に集約したままで、このクラスは
 * ReservationSystemDslが持つ同じマップをコンストラクタで受け取り、一覧応答のroomIdが
 * 登録時にtest-supportから払い出されたものと一致することの検証に使う
 * (contracts/reservation-rooms.feature 解釈ポイント(3): roomIdは業務の言葉に持ち込まないが、
 * 一致検証はstep実装側の責務とされている)。
 *
 * <p>応答のスキーマ機械照合(ADR-0007)は、契約(reservation-api.yaml)原本をswagger-request-validator-
 * restassuredで直接パースして行う(RoomRulesDslと同方式。yamlからの手写しをしない)。
 */
final class RoomListDsl {

    private static final String API_SPEC_PATH = "contracts/reservation-api.yaml";
    private static final String ROOMS_PATH = "/rooms";
    private static final String MIN_RESERVATION_DURATION_KEY = "minReservationDurationMinutes";

    /** 契約原本に対する応答スキーマ照合器(ADR-0007)。パース済みの仕様をシナリオ間で使い回す。 */
    private static final OpenApiInteractionValidator API_SCHEMA_VALIDATOR =
            OpenApiInteractionValidator.createFor(API_SPEC_PATH).build();

    private final String baseUrl;
    /** ReservationSystemDslと共有するroomName→roomIdマップ(単一の源はReservationSystemDsl側)。 */
    private final Map<String, String> roomIdByName;
    private Response lastResponse;

    RoomListDsl(String baseUrl, Map<String, String> roomIdByName) {
        this.baseUrl = baseUrl;
        this.roomIdByName = roomIdByName;
    }

    /** 会議室の一覧を問い合わせる。 */
    void listRooms() {
        lastResponse = RestAssured.given().baseUri(baseUrl).get(ROOMS_PATH);
    }

    /** Given専用seamで登録済みの会議室を全て削除し、会議室が一件も無い状態を作る(RSV-L-02)。 */
    void resetAllRooms() {
        Response res = RestAssured.given().baseUri(baseUrl).delete("/test-support/rooms");
        assertThat(res.statusCode())
                .as("会議室全削除seamの応答: %s", res.asString())
                .isBetween(200, 299);
    }

    /**
     * 直前の一覧確認が受理され(200)、指定した2件の会議室が指定順(表示名昇順)で返り、
     * それぞれのroomIdがGivenで登録済みのものと一致することを検証する(解釈ポイント(3))。
     */
    void assertRoomListOrder(String firstName, String secondName) {
        assertResponseValid();
        JsonPath body = lastResponse.jsonPath();
        assertThat(body.getList("rooms.name", String.class))
                .as("一覧の並び順(表示名)")
                .containsExactly(firstName, secondName);
        assertThat(body.getList("rooms.roomId", String.class))
                .as("一覧のroomId(登録時に払い出されたものと一致すること)")
                .containsExactly(roomIdByName.get(firstName), roomIdByName.get(secondName));
    }

    /**
     * 指定の会議室が、期待する営業時間・定員で一覧に含まれることを検証する。
     * 呼び出し前に一覧を明示的に取得済みとは限らない(RSV-T-01は「一覧を確認する」Whenを持たず、
     * 登録直後にこのThenだけで一覧への反映を確認する)ため、このメソッド自身が最新の一覧を取得する。
     * RSV-L-01(事前にWhenで一覧取得済み)から呼ばれる場合も、状態を変えない再取得のため結果は変わらない。
     */
    void assertRoomIncluded(String roomName, String expectedStart, String expectedEnd, int expectedCapacity) {
        listRooms();
        assertResponseValid();
        JsonPath body = lastResponse.jsonPath();
        List<String> names = body.getList("rooms.name", String.class);
        int index = names.indexOf(roomName);
        assertThat(index).as("一覧に'%s'が含まれること: %s", roomName, names).isNotEqualTo(-1);
        assertThat(body.getString("rooms[%d].businessHoursStart".formatted(index)))
                .as("'%s'の営業時間の開始", roomName).isEqualTo(expectedStart);
        assertThat(body.getString("rooms[%d].businessHoursEnd".formatted(index)))
                .as("'%s'の営業時間の終了", roomName).isEqualTo(expectedEnd);
        assertThat(body.getInt("rooms[%d].capacity".formatted(index)))
                .as("'%s'の定員", roomName).isEqualTo(expectedCapacity);
    }

    /** 一覧のどの要素にも最小予約時間(minReservationDurationMinutes)が含まれないことを検証する。 */
    void assertNoElementHasMinReservationDuration() {
        assertResponseValid();
        List<Map<String, Object>> rooms = lastResponse.jsonPath().getList("rooms");
        assertThat(rooms).as("検証対象となる一覧の要素").isNotEmpty();
        rooms.forEach(room -> assertThat(room)
                .as("一覧要素は最小予約時間を含まないこと: %s", room)
                .doesNotContainKey(MIN_RESERVATION_DURATION_KEY));
    }

    /** 直前の一覧確認が受理され(200)、一覧が空であることを検証する。 */
    void assertRoomListEmpty() {
        assertResponseValid();
        assertThat(lastResponse.jsonPath().getList("rooms")).as("会議室の一覧").isEmpty();
    }

    /**
     * 応答が200であり、契約(reservation-api.yaml)原本のRoomListResponseスキーマに適合することを
     * 機械照合する(ADR-0007)。RSV-L-01/02の各Then/Andが独立して呼び出せるよう、
     * ステータス・スキーマの検証はここに集約する。
     */
    private void assertResponseValid() {
        assertThat(lastResponse.statusCode())
                .as("会議室一覧確認の応答: %s", lastResponse.asString())
                .isEqualTo(200);
        ValidationReport report = API_SCHEMA_VALIDATOR.validateResponse(
                ROOMS_PATH, Request.Method.GET, RestAssuredResponse.of(lastResponse));
        assertThat(report.hasErrors())
                .as("応答が契約(reservation-api.yaml)のスキーマに適合すること: %s", report.getMessages())
                .isFalse();
    }
}
