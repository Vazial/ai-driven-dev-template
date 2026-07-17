package reservation.acceptance.dsl;

import static org.assertj.core.api.Assertions.assertThat;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.model.Request;
import com.atlassian.oai.validator.report.ValidationReport;
import com.atlassian.oai.validator.restassured.RestAssuredResponse;
import io.restassured.RestAssured;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;

/**
 * RSV-R「会議室の予約ルールを確認できる」専用の技術詳細(verification.md L4詳細(1)の第3層)。
 * ReservationSystemDslから解決済みのroomIdを受け取って動く小さな協働クラス
 * (ReservationSystemDsl.javaがcheckstyleのFileLength上限に達したための分離。roomName→roomIdの
 * 解決やGiven状態はReservationSystemDsl側に集約したまま、GET /rooms/{roomId}/rules呼び出しと
 * その応答検証だけをここに閉じ込める)。
 *
 * <p>応答のスキーマ機械照合(ADR-0007)は、契約(reservation-api.yaml)原本をswagger-request-validator-
 * restassuredで直接パースして行う。RSV-A監査の申し送り「JsonSchemaAssertionsはyamlからの手動転記で
 * 二重管理」を踏まえ、新規に追加するこの検証はスキーマを手写ししない方式を採用した。一方、既存の
 * JsonSchemaAssertions利用箇所(assertReservationRejected、assertAvailableSlotsAre)はこのスライスの
 * 変更対象外のため、そのままにしてある(理由はtester報告を参照。範囲外の既存コードへの移行は別途判断)。
 */
final class RoomRulesDsl {

    private static final String API_SPEC_PATH = "contracts/reservation-api.yaml";

    /** 契約原本に対する応答スキーマ照合器(ADR-0007)。パース済みの仕様をシナリオ間で使い回す。 */
    private static final OpenApiInteractionValidator API_SCHEMA_VALIDATOR =
            OpenApiInteractionValidator.createFor(API_SPEC_PATH).build();

    private final String baseUrl;
    private String lastRequestPath;
    private Response lastResponse;

    RoomRulesDsl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    /** 会議室の予約ルールを問い合わせる。応答は呼び出し元(ReservationSystemDsl)にも返す。 */
    Response checkRoomRules(String roomId) {
        lastRequestPath = "/rooms/%s/rules".formatted(roomId);
        lastResponse = RestAssured.given().baseUri(baseUrl).get(lastRequestPath);
        return lastResponse;
    }

    /** 直前の予約ルール確認が受理され(200)、返った営業時間が期待通りであることを検証する。 */
    void assertBusinessHours(String expectedStart, String expectedEnd) {
        assertResponseValid();
        JsonPath body = lastResponse.jsonPath();
        assertThat(body.getString("businessHoursStart")).as("営業時間の開始").isEqualTo(expectedStart);
        assertThat(body.getString("businessHoursEnd")).as("営業時間の終了").isEqualTo(expectedEnd);
    }

    /** 直前の予約ルール確認が受理され(200)、返った定員が期待通りであることを検証する。 */
    void assertCapacity(int expectedCapacity) {
        assertResponseValid();
        assertThat(lastResponse.jsonPath().getInt("capacity")).as("定員").isEqualTo(expectedCapacity);
    }

    /** 直前の予約ルール確認が受理され(200)、返った最小予約時間(分)が期待通りであることを検証する。 */
    void assertMinReservationDuration(int expectedMinutes) {
        assertResponseValid();
        assertThat(lastResponse.jsonPath().getInt("minReservationDurationMinutes"))
                .as("最小予約時間(分)").isEqualTo(expectedMinutes);
    }

    /**
     * 応答が200であり、契約(reservation-api.yaml)原本のRoomRulesResponseスキーマに適合することを
     * 機械照合する(ADR-0007)。RSV-R-01/02の3つのThen/Andがそれぞれ独立して呼び出せるよう、
     * ステータス・スキーマの検証はここに集約する。
     */
    private void assertResponseValid() {
        assertThat(lastResponse.statusCode())
                .as("予約ルール確認の応答: %s", lastResponse.asString())
                .isEqualTo(200);
        ValidationReport report = API_SCHEMA_VALIDATOR.validateResponse(
                lastRequestPath, Request.Method.GET, RestAssuredResponse.of(lastResponse));
        assertThat(report.hasErrors())
                .as("応答が契約(reservation-api.yaml)のスキーマに適合すること: %s", report.getMessages())
                .isFalse();
    }
}
