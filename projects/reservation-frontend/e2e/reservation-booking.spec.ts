import { test, expect } from "@playwright/test";
import { injectReservation, todayIso } from "./helpers";

// contracts/reservation-booking.feature（RFE-B「空いている時間帯を予約できる」）を、実ブラウザで
// 一度だけ走破するE2E（reservation-frontend/adr/0007「今実装する範囲」・meta/adr/0024決定Cの限界を
// 補う安定な回帰の網）。ドメインルール自体はRSV-C（バックエンド契約）・reservationLogic.test.ts
// （Vitest）が検証済みのため、ここでは「画面が空き枠クリックから確定までの流れを正しく仲介するか」
// （RFE-B-01/02）と「拒否理由が画面で分かるか」（RFE-B-03）を実ブラウザで確認する。
//
// 会議室B（room-b、営業時間08:00-20:00、定員10人。src/api/mockData.ts）を使う。今日の日付には
// 会議室Bの予約シードデータが無いため(mockData.tsのseedは2026-07-14のみ)、素の状態では終日
// (08:00〜20:00)が一つの空き区間として表示される。
//
// 欠陥修正の回帰防止(人間レビュー、BookingDialog.tsxの注記参照): クリックした空き帯をまるごと
// 予約するのではなく、空き帯の範囲内で開始・終了時刻を利用者が独立に指定できること
// (control surface、contracts/reservation-booking.feature)。RFE-B-02は、終日空きの帯をクリックした
// 上で開始・終了を"14:00"〜"15:00"に絞り込み、その範囲だけが予約済みになる(終日が丸ごと予約済みには
// ならない)ことを検証することで、この欠陥の再発を防ぐ。

const ROOM_B_ROW = "room-row-room-b";
const TODAY = todayIso();

test.describe("RFE-B: 空いている時間帯を予約できる", () => {
  test("RFE-B-01: 空いている時間帯をクリックすると、予約ダイアログに会議室・日付・時間帯が引き継がれる", async ({
    page,
  }) => {
    await page.goto("/");
    const roomBRow = page.getByTestId(ROOM_B_ROW);
    await expect(roomBRow.getByText("空き 08:00〜20:00")).toBeVisible();

    // "14:00"から"15:00"だけが独立した空き区間になるよう、隣接する予約を用意する
    // (13:00-14:00, 15:00-16:00)。これにより、クリックした空き帯そのものが"14:00"から"15:00"となり、
    // シナリオの前提("14:00"から"15:00"までの空いている時間帯をクリックする")を厳密に再現できる。
    await injectReservation(page, {
      roomId: "room-b",
      reserverId: "e2e-neighbor-1",
      date: TODAY,
      startTime: "13:00",
      endTime: "14:00",
      attendeeCount: 2,
    });
    await injectReservation(page, {
      roomId: "room-b",
      reserverId: "e2e-neighbor-2",
      date: TODAY,
      startTime: "15:00",
      endTime: "16:00",
      attendeeCount: 2,
    });
    // ページを再読み込みせずに(モジュール内の予約台帳を保ったまま)、日付操作で空き状況の
    // 再取得を発火させる(次の日→前の日と1往復して元の日付に戻す)。
    await page.getByRole("button", { name: "次の日" }).click();
    await page.getByRole("button", { name: "前の日" }).click();

    const freeSlot = roomBRow.getByText("空き 14:00〜15:00");
    await expect(freeSlot).toBeVisible();

    // RFE-B-01: 空いている時間帯をクリックする
    await freeSlot.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("会議室B")).toBeVisible();
    await expect(dialog.getByText(TODAY)).toBeVisible();
    await expect(page.locator("#startTime")).toHaveText("14:00");
    await expect(page.locator("#endTime")).toHaveText("15:00");

    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("RFE-B-02: 空いている時間帯を予約すると、指定した範囲だけがタイムラインに反映される", async ({
    page,
  }) => {
    await page.goto("/");
    const roomBRow = page.getByTestId(ROOM_B_ROW);

    const wholeDayFreeSlot = roomBRow.getByText("空き 08:00〜20:00");
    await expect(wholeDayFreeSlot).toBeVisible();
    await wholeDayFreeSlot.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // 欠陥修正の回帰防止: 終日の空き帯をクリックしても、開始・終了時刻を利用者が独立に指定できる
    await page.locator("#startTime").click();
    await page.getByRole("option", { name: "14:00", exact: true }).click();
    await page.locator("#endTime").click();
    await page.getByRole("option", { name: "15:00", exact: true }).click();

    await dialog.locator("#reserverId").fill("sato");
    await dialog.locator("#attendees").fill("4");
    await dialog.getByRole("button", { name: "予約を確定する" }).click();

    // RFE-B-02: 予約が完了したことが画面で分かる
    await expect(page.getByText("予約が完了しました")).toBeVisible();
    await expect(dialog).not.toBeVisible();

    // RFE-B-02: 指定した"14:00"〜"15:00"だけが予約済みになり、それ以外は空きのまま
    // (終日がまるごと予約済みになる欠陥の回帰防止)
    await expect(roomBRow.getByText("空き 08:00〜14:00")).toBeVisible();
    await expect(roomBRow.getByText("予約済み（不可）")).toBeVisible();
    await expect(roomBRow.getByText("空き 15:00〜20:00")).toBeVisible();
    await expect(roomBRow.getByText("空き 08:00〜20:00")).not.toBeVisible();
  });

  test("RFE-B-03: 直前に他の予約者に埋まった時間帯を予約しようとして拒否される", async ({
    page,
  }) => {
    await page.goto("/");
    const roomBRow = page.getByTestId(ROOM_B_ROW);

    const wholeDayFreeSlot = roomBRow.getByText("空き 08:00〜20:00");
    await expect(wholeDayFreeSlot).toBeVisible();
    // Given: 予約ダイアログが"14:00"から"15:00"について開いている
    await wholeDayFreeSlot.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.locator("#startTime").click();
    await page.getByRole("option", { name: "14:00", exact: true }).click();
    // 終了時刻は既定でも"15:00"になるが、開始と独立に指定できることを明示するため明示的に選ぶ
    await page.locator("#endTime").click();
    await page.getByRole("option", { name: "15:00", exact: true }).click();

    // Given: 予約ダイアログを開いた後に、別の予約者が"14:00"から"15:00"を予約済みである。
    // このアプリはバックエンドを持たないため、ダイアログを開いたまま(=このダイアログのslotは
    // まだ古いままの状態)で、別の予約者による予約完了をe2e/helpers.tsのinjectReservationで
    // 直接発生させる(playwright.config.tsのwebServer節・helpers.tsのコメント参照)。
    await injectReservation(page, {
      roomId: "room-b",
      reserverId: "e2e-other-reserver",
      date: TODAY,
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 3,
    });

    await dialog.locator("#reserverId").fill("suzuki");
    await dialog.locator("#attendees").fill("2");
    // When: 予約者が予約者ID"suzuki"・人数2人を入力して予約を確定する
    await dialog.getByRole("button", { name: "予約を確定する" }).click();

    // Then: 予約は拒否され、拒否の理由が画面で分かる
    await expect(page.getByRole("alert")).toContainText(
      "時間帯が既存の予約と重なっています",
    );
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "キャンセル" }).click();

    // Then: "14:00"から"15:00"は予約済み(不可)のままである
    await expect(roomBRow.getByText("空き 08:00〜14:00")).toBeVisible();
    await expect(roomBRow.getByText("予約済み（不可）")).toBeVisible();
    await expect(roomBRow.getByText("空き 15:00〜20:00")).toBeVisible();
  });
});
