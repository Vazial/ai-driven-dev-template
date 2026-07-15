package reservation.acceptance.steps;

import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import reservation.acceptance.dsl.ReservationSystemDsl;

/**
 * スライスRSV-C「予約を作成できる」のstep定義(verification.md L4詳細(1)の第2層)。
 * シナリオ文とテストDSLの対応付けだけを行う薄い糊。技術詳細はdsl/に置く。
 */
public class ReservationCreateSteps {

    private final ReservationSystemDsl dsl = new ReservationSystemDsl();

    @Before
    public void 全予約を削除してシナリオ間の独立性を保つ() {
        dsl.resetAllReservations();
    }

    @Given("会議室{string}が存在する\\(営業時間は{string}から{string}、定員は{int}人\\)")
    public void 会議室が存在する(String roomName, String opensAt, String closesAt, int capacity) {
        dsl.ensureRoomExists(roomName, opensAt, closesAt, capacity);
    }

    @Given("{string}に{string}から{string}までの予約が存在する")
    public void 予約が存在する(String roomName, String startTime, String endTime) {
        dsl.givenReservationExists(roomName, startTime, endTime);
    }

    @When("予約者{string}が{string}を{string}から{string}まで{int}人で予約する")
    public void 予約する(String reserverName, String roomName, String startTime, String endTime, int attendeeCount) {
        dsl.reserve(reserverName, roomName, startTime, endTime, attendeeCount);
    }

    @Then("予約は作成される")
    public void 予約は作成される() {
        dsl.assertReservationCreated();
    }

    @Then("予約は{string}という理由で拒否される")
    public void 予約は拒否される(String reasonText) {
        dsl.assertReservationRejected(reasonText);
    }

    @Then("{string}の{string}から{string}は{string}の予約で占有されている")
    public void 時間帯は予約で占有されている(String roomName, String startTime, String endTime, String reserverName) {
        dsl.assertSlotOccupiedBy(roomName, startTime, endTime, reserverName);
    }
}
