package reservation.acceptance.steps;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import reservation.acceptance.dsl.RoomRegistrationDsl;

/**
 * スライスRSV-T「会議室を登録できる」のstep定義(verification.md L4詳細(1)の第2層)。
 * シナリオ文とテストDSLの対応付けだけを行う薄い糊。技術詳細はdsl/RoomRegistrationDslに置く。
 *
 * <p>ReservationCreateStepsに合流させず、独立したクラスにした理由: RSV-Tの登録操作
 * (POST /rooms)はReservationSystemDslが持つroomName→roomIdの状態(RSV-C以降の各stepが
 * 共有する)を必要としない。共有すべき状態が無いため、ReservationCreateStepsが複数スライスの
 * stepを1クラスに集約している理由(Cucumberの動的インスタンス化がクラスをまたいだ状態共有を
 * サポートしないため、同ファイルjavadoc参照)がRSV-Tには当てはまらない。activeContext.mdの
 * 技術的宿題(ReservationCreateStepsの肥大)を、状態共有が不要な新スライスでは増やさない判断。
 *
 * <p>会議室の存在をGivenとして作る"会議室{string}が存在する(...)"、および登録結果を一覧で
 * 確認する"{string}については...一覧に含まれる"は、RSV-Lで定義済みの既存stepをそのまま再利用する
 * (ReservationCreateStepsに定義済み)。同義の新規stepを作らない(verification.md L4詳細(1))。
 */
public class RoomRegistrationSteps {

    private final RoomRegistrationDsl dsl = new RoomRegistrationDsl();

    @When("管理者が会議室{string}を登録する\\(営業時間は{string}から{string}、定員は{int}人\\)")
    public void 管理者が会議室を登録する(String roomName, String opensAt, String closesAt, int capacity) {
        dsl.registerRoom(roomName, opensAt, closesAt, capacity);
    }

    @Then("会議室は登録される")
    public void 会議室は登録される() {
        dsl.assertRoomRegistered();
    }

    @Then("会議室の登録は{string}という理由で拒否される")
    public void 会議室の登録は拒否される(String reasonText) {
        dsl.assertRegistrationRejected(reasonText);
    }
}
