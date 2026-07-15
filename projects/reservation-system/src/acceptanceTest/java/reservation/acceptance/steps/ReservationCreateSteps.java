package reservation.acceptance.steps;

import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import reservation.acceptance.dsl.ReservationSystemDsl;

/**
 * スライスRSV-C「予約を作成できる」+ RSV-K「予約をキャンセルできる」のstep定義
 * (verification.md L4詳細(1)の第2層)。シナリオ文とテストDSLの対応付けだけを行う薄い糊。技術詳細はdsl/に置く。
 *
 * <p>両スライスのstepを同じクラスに置く理由: Cucumberのデフォルトの動的インスタンス化
 * (io.cucumber.core.backend.DefaultObjectFactory、build.gradleにcucumber-picocontainer等の
 * DIモジュールを追加していない)は、glueクラスをクラスごとに1個ずつ独立にキャッシュするだけで、
 * クラスをまたいだコンストラクタ注入によるインスタンス共有をサポートしない。
 * RSV-Kのstep(キャンセル)はBackgroundの会議室セットアップ(RSV-Cのstep)が積んだ
 * {@code dsl}の状態(会議室名→ID)をそのまま使う必要があるため、別クラスに分けると
 * 別インスタンスのDSLになり前提が壊れる。そのため1シナリオ1インスタンスが保証される
 * この1クラスに集約する(必要ならDIモジュール追加をorchestratorにエスカレーションする)。
 */
public class ReservationCreateSteps {

    private final ReservationSystemDsl dsl = new ReservationSystemDsl();

    @Before
    public void 全予約を削除してシナリオ間の独立性を保つ() {
        dsl.resetAllReservations();
        dsl.fixCurrentTimeToBaseDate();
    }

    @Given("会議室{string}が存在する\\(営業時間は{string}から{string}、定員は{int}人\\)")
    public void 会議室が存在する(String roomName, String opensAt, String closesAt, int capacity) {
        dsl.ensureRoomExists(roomName, opensAt, closesAt, capacity);
    }

    @Given("{string}に{string}から{string}までの予約が存在する")
    public void 予約が存在する(String roomName, String startTime, String endTime) {
        dsl.givenReservationExists(roomName, startTime, endTime);
    }

    @Given("{string}に予約者{string}の{string}から{string}までの予約が存在する")
    public void 予約者の予約が存在する(String roomName, String reserverName, String startTime, String endTime) {
        dsl.givenOwnedReservationExists(roomName, reserverName, startTime, endTime);
    }

    @Given("現在時刻は{string}である")
    public void 現在時刻である(String timeOfDay) {
        dsl.setCurrentTime(timeOfDay);
    }

    @Given("予約者{string}が{string}の{string}から{string}の予約をキャンセルしている")
    public void 予約をキャンセルしている(String reserverName, String roomName, String startTime, String endTime) {
        dsl.givenReservationAlreadyCancelled(reserverName, roomName, startTime, endTime);
    }

    @When("予約者{string}が{string}を{string}から{string}まで{int}人で予約する")
    public void 予約する(String reserverName, String roomName, String startTime, String endTime, int attendeeCount) {
        dsl.reserve(reserverName, roomName, startTime, endTime, attendeeCount);
    }

    // 「再び」は任意語。1回目・2回目とも同じキャンセル操作を行うだけなので同じstepで受ける
    @When("予約者{string}が{string}の{string}から{string}の予約を(再び)キャンセルする")
    public void 予約をキャンセルする(String reserverName, String roomName, String startTime, String endTime) {
        dsl.cancelReservation(reserverName, roomName, startTime, endTime);
    }

    @Then("予約は作成される")
    public void 予約は作成される() {
        dsl.assertReservationCreated();
    }

    @Then("予約はキャンセルされる")
    public void 予約はキャンセルされる() {
        dsl.assertReservationCancelled();
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
