package reservation.acceptance.dsl;

import static org.assertj.core.api.Assertions.assertThat;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.model.Request;
import com.atlassian.oai.validator.report.ValidationReport;
import com.atlassian.oai.validator.restassured.RestAssuredResponse;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;
import java.util.Map;

/**
 * スライスRSV-T「会議室を登録できる」専用のテストDSL(verification.md L4詳細(1)の第3層)。
 * 業務API(POST /rooms、業務の重複拒否・営業時間妥当性を実施)のみを操作対象とし、
 * Given専用seam(POST /test-support/rooms、同名は上書きする冪等setup)には触れない
 * (contracts/reservation-room-registration.feature 解釈ポイント(8)、reservation-api.yaml RSV-T
 * 解釈ポイント(3)(4)を参照。両者は役割が異なるため意図的に別クラスにしている)。
 *
 * <p>RSV-Tの登録操作(POST /rooms)はRSV-C(予約作成)のようなroomId解決を必要としない
 * (会議室名だけで登録・拒否判定が完結する)ため、ReservationSystemDslが持つroomIdByNameを
 * 共有する必要が無い。そのためReservationCreateStepsとインスタンスを共有する制約(同クラスの
 * javadoc参照)を受けず、独立したstepクラス(RoomRegistrationSteps)から直接使う
 * (activeContext.mdの技術的宿題「ReservationCreateStepsへの集約が5スライスで肥大」を、
 * 状態共有が不要な新スライスでは避ける判断)。
 *
 * <p>応答のスキーマ機械照合(ADR-0007)は、契約(reservation-api.yaml)原本をswagger-request-validator-
 * restassuredで直接パースして行う(RoomRulesDsl/RoomListDslと同方式)。成功(201)・拒否(409/422)の
 * 両方に適用する — RSV-Tが新規に追加する拒否理由コード(ROOM_NAME_DUPLICATE・INVALID_BUSINESS_HOURS)を
 * 手写しスキーマ(JsonSchemaAssertions)に複製しないための判断(活動記録の技術的宿題「スキーマ照合の
 * 新旧混在」に対し、新規追加分は最新方式へ寄せる)。
 */
public final class RoomRegistrationDsl {

    private static final String BASE_URL =
            System.getenv().getOrDefault("RESERVATION_API_BASE_URL", "http://localhost:8080");
    private static final String API_SPEC_PATH = "contracts/reservation-api.yaml";
    private static final String ROOMS_PATH = "/rooms";

    /** 拒否理由の文言 → HTTPステータス+理由コード。出典: reservation-api.yaml RSV-T追記の対応表。 */
    private static final Map<String, ExpectedRejection> REJECTION_BY_REASON = Map.of(
            "同じ名前の会議室が既に存在する", new ExpectedRejection(409, "ROOM_NAME_DUPLICATE"),
            "営業時間の終了時刻は開始時刻より後でなければならない", new ExpectedRejection(422, "INVALID_BUSINESS_HOURS"));

    /** 契約原本に対する応答スキーマ照合器(ADR-0007)。パース済みの仕様をシナリオ間で使い回す。 */
    private static final OpenApiInteractionValidator API_SCHEMA_VALIDATOR =
            OpenApiInteractionValidator.createFor(API_SPEC_PATH).build();

    private RoomRegistrationRequest lastRequest;
    private Response lastResponse;

    /** 会議室の登録を試みる。成否の検証はThen側のassertメソッドが行う。 */
    public void registerRoom(String name, String opensAt, String closesAt, int capacity) {
        lastRequest = new RoomRegistrationRequest(name, opensAt, closesAt, capacity);
        lastResponse = RestAssured.given().baseUri(BASE_URL).contentType(ContentType.JSON)
                .body("""
                        {"name": "%s", "businessHoursStart": "%s", "businessHoursEnd": "%s", "capacity": %d}"""
                        .formatted(name, opensAt, closesAt, capacity))
                .post(ROOMS_PATH);
    }

    /** 直前の登録操作が受理され(201)、依頼した内容の会議室として返ったことを検証する。 */
    public void assertRoomRegistered() {
        assertThat(lastResponse.statusCode())
                .as("会議室登録の応答: %s", lastResponse.asString())
                .isEqualTo(201);
        assertMatchesApiSchema();
        JsonPath body = lastResponse.jsonPath();
        assertThat(body.getString("roomId")).as("会議室ID(サーバ採番)").isNotBlank();
        assertThat(body.getString("name")).isEqualTo(lastRequest.name());
        assertThat(body.getString("businessHoursStart")).isEqualTo(lastRequest.opensAt());
        assertThat(body.getString("businessHoursEnd")).isEqualTo(lastRequest.closesAt());
        assertThat(body.getInt("capacity")).isEqualTo(lastRequest.capacity());
    }

    /** 直前の登録操作が、契約の対応表通りのHTTPステータス+理由コードで拒否されたことを検証する。 */
    public void assertRegistrationRejected(String reasonText) {
        ExpectedRejection expected = REJECTION_BY_REASON.get(reasonText);
        assertThat(expected)
                .as("契約(reservation-api.yaml)の対応表にない拒否理由の文言: %s", reasonText)
                .isNotNull();
        assertThat(lastResponse.statusCode())
                .as("拒否応答: %s", lastResponse.asString())
                .isEqualTo(expected.httpStatus());
        assertMatchesApiSchema();
        assertThat(lastResponse.jsonPath().getString("code")).isEqualTo(expected.code());
        assertThat(lastResponse.jsonPath().getString("message")).as("人間が読める説明").isNotBlank();
    }

    private void assertMatchesApiSchema() {
        ValidationReport report = API_SCHEMA_VALIDATOR.validateResponse(
                ROOMS_PATH, Request.Method.POST, RestAssuredResponse.of(lastResponse));
        assertThat(report.hasErrors())
                .as("応答が契約(reservation-api.yaml)のスキーマに適合すること: %s", report.getMessages())
                .isFalse();
    }

    private record RoomRegistrationRequest(String name, String opensAt, String closesAt, int capacity) { }

    private record ExpectedRejection(int httpStatus, String code) { }
}
