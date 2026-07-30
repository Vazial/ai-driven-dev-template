import { test, expect } from "@playwright/test";
import {
  bookRoomViaUi,
  cancelMyReservation,
  cancelReservationInBackground,
  myReservationEntry,
  openMyReservations,
  todayIso,
} from "./helpers";

// contracts/my-reservations.feature（RFE-C「自分の予約を確認してキャンセルできる」）を、実ブラウザで
// 一度だけ走破するE2E（reservation-frontend/adr/0007「今実装する範囲」・meta/adr/0024決定Cの限界を
// 補う安定な回帰の網）。キャンセルのドメインルール（開始15分前ルール・二重キャンセルの拒否）自体は
// バックエンド契約RSV-K（projects/reservation-system/contracts/reservation-cancel.feature）が検証済み
// のため、ここでは「画面が一覧の表示・キャンセル操作を正しく仲介するか」（RFE-C-01/02/03）と「拒否理由
// が画面で分かるか」（RFE-C-04/05）を実ブラウザで確認する。
//
// 会議室A（room-a、営業時間09:00-18:00、定員6人。contracts/my-reservations.feature Background）を使う。
// 契約本文の日付"2026-07-14"は文字どおりには使わず「今日」に置き換える。理由は
// e2e/reservation-booking.spec.tsが会議室Bで日付を「今日」にした理由と同じ——このアプリはバックエンドを
// 持たず、予約台帳はブラウザのJSモジュールインスタンス内にのみ存在するため、固定の過去日付に依拠すると
// その日付に紐づく他スライスのシードデータとの衝突を避けられない。会議室Aは「今日」の日付には終日
// （09:00〜18:00）が空きの単一区間になることを、既存の合格済みE2E（e2e/availability-view.spec.ts）で
// 確認済みであり、この組み合わせ（会議室A・今日）が汚れていないことの根拠にしている。日付の値そのものは
// このスライスの業務的な検証対象ではない——予約時に指定した日付と、一覧・キャンセルで扱われる日付が
// 一致することが本質であり、その値が"today"か"2026-07-14"かは無関係である。
//
// セレクタの根拠: 「自分の予約」トリガー・パネル・予約なし時の文言は、人間承認済みの画面設計
// （src/design-preview/BookingDesign.tsx）にある該当ブロックの文言を根拠にする。ただしキャンセル操作
// のボタン自体は同設計でTrash2アイコンのみ（可視ラベル・アクセシブルな名前が定義されていない）ため、
// e2e/helpers.tsのcancelMyReservationのコメントに明記した通り、名前は推測であり根拠が弱い
// （developerの実装確定後に調整が必要な可能性が高い、このスライスで最も弱いセレクタ）。
//
// RFE-C-01/03/05は「現在時刻」をシナリオ本文に明示しない（キャンセル可否の判定に現在時刻が関わるのは
// RFE-C-04だけ）。にもかかわらず、"14:00"から"15:00"という固定の時刻を実際の壁時計時刻のまま予約すると、
// テストを実行する時刻によって開始15分前ルールの成立・不成立が偶然変わってしまう（このテストの実行で
// 実際に踏んだ——実行時刻が13:45を過ぎていたため、キャンセル成功を検証するはずのRFE-C-03が意図せず
// 拒否側の経路に落ちた）。これは契約が明示していない暗黙の前提であり、page.clockで「現在時刻は"14:00"
// より十分前」に固定することでシナリオが述べている通りの状況（キャンセル期限に無関係な、通常のキャンセル・
// 二重キャンセル）だけを再現する。

const ROOM_A_ROW = "room-row-room-a";
const TODAY = todayIso();
// RFE-C-01/03/05で使う「開始15分前ルールに掛からない、予約対象時刻(14:00)より十分前」の固定時刻
const SAFE_MORNING_TIME = new Date(`${TODAY}T08:00:00`);

test.describe("RFE-C: 自分の予約を確認してキャンセルできる", () => {
  test("RFE-C-01: この端末で行った予約が一覧に表示される", async ({ page }) => {
    await page.clock.setFixedTime(SAFE_MORNING_TIME);
    await page.goto("/");
    // Given: 予約者が"会議室A"を(今日)の"14:00"から"15:00"まで予約しており、この端末に自分の
    // 予約として記録が残っている
    await bookRoomViaUi(page, {
      roomTestId: ROOM_A_ROW,
      startTime: "14:00",
      endTime: "15:00",
      reserverId: "e2e-rfe-c-01",
      attendeeCount: 2,
    });

    // When: 予約者が自分の予約の一覧画面を開く
    const panel = await openMyReservations(page);

    // Then: 一覧に"会議室A"の(今日)の"14:00"から"15:00"の予約が表示される
    // (4項目がそれぞれ一覧内のどこかに存在するだけでなく、同一のエントリに属していることを要求する。
    // e2e/helpers.tsのmyReservationEntry参照)
    const entry = myReservationEntry(panel, {
      roomName: "会議室A",
      date: TODAY,
      startTime: "14:00",
      endTime: "15:00",
    });
    await expect(entry).toBeVisible();
  });

  test("RFE-C-02: この端末で予約を一度も行っていない場合、その旨が画面で分かる", async ({
    page,
  }) => {
    await page.goto("/");

    // When: 予約者が自分の予約の一覧画面を開く
    const panel = await openMyReservations(page);

    // Then: 自分の予約が一件もないことが画面で分かる。文言はこのスライスでは固定しない
    // （解釈ポイント(6)）。承認済み設計（BookingDesign.tsx）のプレースホルダ文言を暫定の根拠にする
    await expect(panel.getByText(/予約はありません/)).toBeVisible();
  });

  test("RFE-C-03: 自分の予約をキャンセルする", async ({ page }) => {
    await page.clock.setFixedTime(SAFE_MORNING_TIME);
    await page.goto("/");
    // Given: 予約者が"会議室A"を(今日)の"14:00"から"15:00"まで予約しており、この端末に自分の
    // 予約として記録が残っている
    await bookRoomViaUi(page, {
      roomTestId: ROOM_A_ROW,
      startTime: "14:00",
      endTime: "15:00",
      reserverId: "e2e-rfe-c-03",
      attendeeCount: 2,
    });
    const panel = await openMyReservations(page);
    const entry = myReservationEntry(panel, {
      roomName: "会議室A",
      date: TODAY,
      startTime: "14:00",
      endTime: "15:00",
    });
    await expect(entry).toBeVisible();

    // When: 予約者が自分の予約の一覧からその予約をキャンセルする
    await cancelMyReservation(panel);

    // Then: 予約がキャンセルされたことが画面で分かる。文言は根拠が弱い（e2e/helpers.ts参照、
    // 承認済み設計のtoast.info文言を暫定の根拠にする）
    await expect(page.getByText("予約をキャンセルしました")).toBeVisible();

    // Then: 自分の予約の一覧からその予約が消える
    await expect(entry).not.toBeVisible();

    // Then: "会議室A"の(今日)の空き状況画面で"14:00"から"15:00"は再び空きになる
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    const roomARow = page.getByTestId(ROOM_A_ROW);
    await expect(roomARow.getByText("空き 09:00〜18:00")).toBeVisible();
  });

  test("RFE-C-04: 開始直前になった予約をキャンセルしようとして拒否される", async ({
    page,
  }) => {
    // page.clock（Playwright 1.62）でブラウザ時計を固定する。まず業務時間内の早い時刻に固定し、
    // 予約を作成したのち、Givenが明示する"10:15"まで進める。
    await page.clock.setFixedTime(new Date(`${TODAY}T09:30:00`));
    await page.goto("/");
    // Given: 予約者が"会議室A"を(今日)の"10:00"から"11:00"まで予約しており、この端末に自分の
    // 予約として記録が残っている
    await bookRoomViaUi(page, {
      roomTestId: ROOM_A_ROW,
      startTime: "10:00",
      endTime: "11:00",
      reserverId: "e2e-rfe-c-04",
      attendeeCount: 2,
    });

    // Given: 現在時刻は"10:15"である
    await page.clock.setFixedTime(new Date(`${TODAY}T10:15:00`));

    const panel = await openMyReservations(page);
    const entry = myReservationEntry(panel, {
      roomName: "会議室A",
      date: TODAY,
      startTime: "10:00",
      endTime: "11:00",
    });
    await expect(entry).toBeVisible();

    // When: 予約者が自分の予約の一覧からその予約をキャンセルする
    // (解釈ポイント(4): この画面は開始15分前ルールを先読み判定しない。キャンセル操作自体は
    // 提示され続け、拒否はサーバ応答が決める。ここでは操作を無効化・非表示にしていないことを
    // 前段のexpectで確認したうえで、実際にキャンセルを試みる)
    await cancelMyReservation(panel);

    // Then: 予約は拒否され、拒否の理由が画面で分かる。文言の完全一致には固定しない
    // （解釈ポイント(6)）が、単に何か表示されただけでなく「期限に関する理由」であることまでを
    // 業務語彙の候補（開始・15分・期限・過ぎ）で確認し、空でないことだけの弱い検証にとどめない
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).not.toBeEmpty();
    await expect(alert).toContainText(/15分|期限|過ぎ/);

    // Then: 自分の予約の一覧にその予約が残ったままである
    await expect(entry).toBeVisible();
  });

  test("RFE-C-05: 別の画面で既にキャンセル済みの予約を、一覧が更新されないままもう一度キャンセルしようとして拒否される", async ({
    page,
  }) => {
    await page.clock.setFixedTime(SAFE_MORNING_TIME);
    await page.goto("/");
    // Given: 予約者が"会議室A"を(今日)の"14:00"から"15:00"まで予約しており、この端末に自分の
    // 予約として記録が残っている
    await bookRoomViaUi(page, {
      roomTestId: ROOM_A_ROW,
      startTime: "14:00",
      endTime: "15:00",
      reserverId: "e2e-rfe-c-05",
      attendeeCount: 2,
    });

    // Given: 自分の予約の一覧画面を開いた後に、
    const panel = await openMyReservations(page);
    const entry = myReservationEntry(panel, {
      roomName: "会議室A",
      date: TODAY,
      startTime: "14:00",
      endTime: "15:00",
    });
    await expect(entry).toBeVisible();

    // 別の画面で予約者が同じ予約を既にキャンセルしている: 端末の記録（localStorage、この一覧が
    // 見ている情報）はページ間・画面間で共有されるが、キャンセルの確定を判定する側はページの
    // JSモジュールインスタンスごとに独立しており、別ページを開いてもそこへは到達できない
    // （e2e/helpers.tsのcancelReservationInBackground参照。当初context.newPage()で2ページ構成を
    // 試みたが、この理由で「別画面での先行キャンセル成功」自体をUIから再現できず、成立しなかった）。
    // したがって同一ページ上でキャンセルの確定側だけを直接キャンセル済みにし、この一覧（端末の記録）
    // はまだそれを知らない状態を作る
    await cancelReservationInBackground(page, {
      roomId: "room-a",
      date: TODAY,
      startTime: "14:00",
      endTime: "15:00",
    });

    // When: 予約者が(更新していない)自分の予約の一覧からその予約をキャンセルする
    await cancelMyReservation(panel);

    // Then: 予約は拒否され、拒否の理由が画面で分かる
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).not.toBeEmpty();
  });
});
