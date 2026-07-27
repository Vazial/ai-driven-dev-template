package reservation.acceptance.steps;

import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import reservation.acceptance.dsl.ReservationSystemDsl;

/**
 * スライスRSV-C「予約を作成できる」+ RSV-K「予約をキャンセルできる」+ RSV-A「空き枠を確認できる」+
 * RSV-R「予約ルールを確認できる」のstep定義(verification.md L4詳細(1)の第2層)。
 * シナリオ文とテストDSLの対応付けだけを行う薄い糊。技術詳細はdsl/に置く。
 *
 * <p>全スライスのstepを同じクラスに置く理由: Cucumberのデフォルトの動的インスタンス化
 * (io.cucumber.core.backend.DefaultObjectFactory、build.gradleにcucumber-picocontainer等の
 * DIモジュールを追加していない)は、glueクラスをクラスごとに1個ずつ独立にキャッシュするだけで、
 * クラスをまたいだコンストラクタ注入によるインスタンス共有をサポートしない。
 * RSV-Kのstep(キャンセル)・RSV-Aのstep(空き枠確認)・RSV-Rのstep(予約ルール確認)はいずれも
 * Backgroundの会議室セットアップ(RSV-Cのstep)が積んだ{@code dsl}の状態(会議室名→ID)を
 * そのまま使う必要があるため、別クラスに分けると別インスタンスのDSLになり前提が壊れる。
 * そのため1シナリオ1インスタンスが保証されるこの1クラスに集約する
 * (必要ならDIモジュール追加をorchestratorにエスカレーションする。RSV-A監査からの継続申し送り事項、
 * 4節参照)。
 */
public class ReservationCreateSteps {

    private final ReservationSystemDsl dsl = new ReservationSystemDsl();

    @Before
    public void 全予約を削除してシナリオ間の独立性を保つ() {
        dsl.resetAllReservations();
        // 会議室も毎シナリオ前にゼロ件へ戻す。RSV-L-01の「一覧は2件返る」が、他スライスのGivenで
        // 作られた会議室の累積で崩れないようにするため(各既存Givenは"会議室{string}が存在する"で
        // 都度作り直すので、事前の全削除は他スライスの前提を壊さない)。
        dsl.resetAllRooms();
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

    @When("予約者が{string}の空き枠を確認する")
    public void 空き枠を確認する(String roomName) {
        dsl.checkAvailability(roomName);
    }

    @Then("空いている時間帯として{string}から{string}が返る")
    public void 空いている時間帯が一件返る(String startTime, String endTime) {
        dsl.assertAvailableSlots(startTime, endTime);
    }

    @Then("空いている時間帯として{string}から{string}と{string}から{string}が返る")
    public void 空いている時間帯が二件返る(String firstStart, String firstEnd, String secondStart, String secondEnd) {
        dsl.assertAvailableSlots(firstStart, firstEnd, secondStart, secondEnd);
    }

    @Then("空いている時間帯は一つもない")
    public void 空いている時間帯は一つもない() {
        dsl.assertNoAvailableSlots();
    }

    @Then("空き枠の確認は{string}という理由で拒否される")
    public void 空き枠の確認は拒否される(String reasonText) {
        dsl.assertReservationRejected(reasonText);
    }

    @When("予約者が{string}の予約ルールを確認する")
    public void 予約ルールを確認する(String roomName) {
        dsl.checkRoomRules(roomName);
    }

    @Then("営業時間は{string}から{string}であることが返る")
    public void 営業時間が返る(String start, String end) {
        dsl.assertBusinessHours(start, end);
    }

    @Then("定員は{int}人であることが返る")
    public void 定員が返る(int capacity) {
        dsl.assertCapacity(capacity);
    }

    @Then("最小予約時間は{int}分であることが返る")
    public void 最小予約時間が返る(int minutes) {
        dsl.assertMinReservationDuration(minutes);
    }

    @Then("予約ルールの確認は{string}という理由で拒否される")
    public void 予約ルールの確認は拒否される(String reasonText) {
        dsl.assertReservationRejected(reasonText);
    }

    // ---- RSV-L: 会議室の一覧を確認できる ----

    @Given("会議室が一件も登録されていない")
    public void 会議室が一件も登録されていない() {
        dsl.resetAllRooms();
    }

    @When("予約者が会議室の一覧を確認する")
    public void 予約者が会議室の一覧を確認する() {
        dsl.listRooms();
    }

    @Then("会議室の一覧は2件返り、1件目は{string}、2件目は{string}である")
    public void 会議室の一覧は2件返り(String firstName, String secondName) {
        dsl.assertRoomListOrder(firstName, secondName);
    }

    @Then("{string}については営業時間{string}から{string}、定員{int}人であることが一覧に含まれる")
    public void 営業時間と定員が一覧に含まれる(String roomName, String start, String end, int capacity) {
        dsl.assertRoomIncludedInList(roomName, start, end, capacity);
    }

    @Then("一覧のどの要素にも最小予約時間は含まれない")
    public void 一覧のどの要素にも最小予約時間は含まれない() {
        dsl.assertNoRoomHasMinReservationDuration();
    }

    @Then("会議室の一覧は空である")
    public void 会議室の一覧は空である() {
        dsl.assertRoomListEmpty();
    }
}
