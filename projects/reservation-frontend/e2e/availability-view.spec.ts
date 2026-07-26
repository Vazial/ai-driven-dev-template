import { test, expect } from "@playwright/test";

// contracts/availability-view.feature（RFE-A「会議室の空き状況を画面で確認できる」）を、実ブラウザで
// 一度だけ走破するE2E（reservation-frontend/adr/0007「今実装する範囲」）。ドメインロジック自体は
// AvailabilityScreen.test.tsx（Vitest）が既に検証済みのため、ここでは「開いた瞬間に会議室ごとの
// タイムラインが出て、会議室ごとの営業時間が軸に反映される」という、実ブラウザでしか確認できない
// 描画結果を軽く確認する（1ケースでよい、ADR-0007）。
//
// 会議室ごとに営業時間が異なる（src/api/mockData.ts）: 会議室A 09:00-18:00 / 会議室B 08:00-20:00 /
// 集中ブース 08:00-22:00。今日の日付（予約シードデータが存在しない日、mockData.ts参照）を開けば、
// どの会議室も終日空きの単一区間として表示されるため、各行の「空き」ラベルの時刻がその会議室自身の
// 営業時間と一致するかどうかで、「会議室ごとの営業時間が軸に反映される」ことを確認できる。

test("RFE-A: 空き状況画面を開くと、会議室ごとのタイムラインが営業時間を反映して表示される", async ({
  page,
}) => {
  await page.goto("/");

  const roomARow = page.getByTestId("room-row-room-a");
  const roomBRow = page.getByTestId("room-row-room-b");
  const roomCRow = page.getByTestId("room-row-room-c");

  // 開いた瞬間に会議室ごとのタイムラインが一覧で見える(会議室選択という操作を要求しない、
  // contracts/availability-view.feature 「会議室は自由度に含めない」)
  await expect(roomARow).toBeVisible();
  await expect(roomBRow).toBeVisible();
  await expect(roomCRow).toBeVisible();

  // 会議室ごとの営業時間が軸に反映される(会議室Aは09:00-18:00、会議室Bは08:00-20:00、
  // 集中ブースは08:00-22:00。src/api/mockData.ts)
  await expect(roomARow.getByText("空き 09:00〜18:00")).toBeVisible();
  await expect(roomBRow.getByText("空き 08:00〜20:00")).toBeVisible();
  await expect(roomCRow.getByText("空き 08:00〜22:00")).toBeVisible();
});
