import type { Locator, Page } from "@playwright/test";

/**
 * このアプリはバックエンドを持たず、予約台帳（MOCK_RESERVATIONS、src/api/mockData.ts）は
 * ブラウザのJSモジュールインスタンス内にのみ存在する（playwright.config.ts の webServer 節参照）。
 *
 * injectReservation は、Vite開発サーバがソースをそのままのパスでESモジュールとして配信することを
 * 利用し、ページが既に読み込み済みの `createReservation` モジュールインスタンスに対して直接
 * 予約を1件作成する。これにより「予約ダイアログを開いた後に、別の予約者が先に予約を確定する」
 * （contracts/reservation-booking.feature RFE-B-03）を、真の同時実行を持たないモックAPIの上でも
 * 安定的に再現できる。UI操作の代替ではなく、UIだけでは作れない「バックグラウンドでの競合」という
 * 前提条件を成立させるための補助手段としてのみ使う（確定操作自体・拒否理由の検証は常にUI経由で行う）。
 */
export async function injectReservation(
  page: Page,
  input: {
    roomId: string;
    reserverId: string;
    date: string;
    startTime: string;
    endTime: string;
    attendeeCount: number;
  },
): Promise<void> {
  const result = await page.evaluate(async (reservation) => {
    const mod = await import("/src/api/reservations.ts");
    return mod.createReservation(reservation);
  }, input);
  if (!result.ok) {
    throw new Error(
      `injectReservation: モックAPIが拒否した(テストデータ不正の可能性): ${JSON.stringify(result)}`,
    );
  }
}

/** date-fns の format(date, "yyyy-MM-dd") と同じ意味論(ローカル日付)で今日の日付文字列を返す */
export function todayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * contracts/reservation-booking.feature（RFE-B、e2e/reservation-booking.spec.ts）と同じ手順を
 * UI操作で再現し、contracts/my-reservations.feature（RFE-C）の前提「この端末に自分の予約として
 * 記録が残っている」を、SUTの公開境界（UI）経由で作る（meta/verification.md L4詳細(1)）。
 * 空き帯の境界を仮定せず、対象の時間帯を含む空き帯であればどの範囲でも動作する
 * （RFE-B-02と同じ、開始・終了時刻を独立に指定する手順）。
 */
export async function bookRoomViaUi(
  page: Page,
  input: {
    roomTestId: string;
    startTime: string;
    endTime: string;
    reserverId: string;
    attendeeCount: number;
  },
): Promise<void> {
  const roomRow = page.getByTestId(input.roomTestId);
  await roomRow.getByText(/^空き /).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.locator("#startTime").click();
  await page.getByRole("option", { name: input.startTime, exact: true }).click();
  await page.locator("#endTime").click();
  await page.getByRole("option", { name: input.endTime, exact: true }).click();
  await dialog.locator("#reserverId").fill(input.reserverId);
  await dialog.locator("#attendees").fill(String(input.attendeeCount));
  await dialog.getByRole("button", { name: "予約を確定する" }).click();
  await dialog.waitFor({ state: "hidden" });
}

/**
 * 「自分の予約」一覧画面を開く。トリガーの名前は人間承認済みの画面設計
 * （src/design-preview/BookingDesign.tsx の SheetTrigger）の文言「自分の予約」に基づく。
 * バッジで件数が付加された場合（同ファイル参照）に備え、名前は前方一致に緩めている。
 */
export async function openMyReservations(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /自分の予約/ }).click();
  const panel = page.getByRole("dialog");
  await panel.waitFor();
  return panel;
}

/**
 * 一覧内の予約1件をキャンセルする。
 *
 * 根拠が弱いセレクタ: 承認済みの画面設計（src/design-preview/BookingDesign.tsx）では、
 * キャンセル操作はTrash2アイコンのみのボタンで、可視のラベル・アクセシブルな名前が定義されて
 * いない。「キャンセル」「取り消し」を業務語彙としての名前候補にしているが、これは確定できる
 * 根拠ではなく推測である。developerの実装確定後、実際のボタン名に合わせて調整が必要になる
 * 可能性が高い（このスライスで最も弱いセレクタ）。
 */
export async function cancelMyReservation(panel: Locator): Promise<void> {
  await panel.getByRole("button", { name: /キャンセル|取り消し/ }).click();
}

/**
 * 一覧内の、会議室名・日付・開始・終了の4項目が「同一のエントリ」に属していることを要求する形で
 * 予約1件を指す Locator を返す（4項目それぞれが一覧内のどこかに存在するだけの確認では、複数の
 * 予約が並んだ場合に別々のエントリの値を拾ってしまっても通ってしまうため）。DOM上の具体的な
 * 要素構造（タグ・role）は承認済み設計でも確定していないため、4項目すべてを同時に含む最小の
 * 祖先要素を「そのエントリ」とみなす。
 */
export function myReservationEntry(
  panel: Locator,
  input: { roomName: string; date: string; startTime: string; endTime: string },
): Locator {
  return panel
    .locator("div")
    .filter({ hasText: input.roomName })
    .filter({ hasText: input.date })
    .filter({ hasText: input.startTime })
    .filter({ hasText: input.endTime })
    .last();
}

/**
 * 予約の確定を判定する側（キャンセルの受付）だけを直接キャンセル済みにし、端末の記録
 * （localStorage、画面側が書き込む「自分の予約」一覧のもとデータ）には触れない。
 *
 * 「自分の予約」一覧はこの端末の記録を見て組み立てられる一方、キャンセルの確定操作は別の場所で
 * 可否を判定する（reservation-frontend/adr/0001「最終判定は常にAPI応答に委ねる」）。この非対称性を
 * 使うと、「別の画面で予約者が同じ予約を既にキャンセルしている」（contracts/my-reservations.feature
 * RFE-C-05）——一覧にはまだ予約が残って見えるのに、確定を試みると拒否される、という画面の状態が
 * 最新でない状況——をUI操作だけでは作れない。したがってinjectReservation（e2e/helpers.ts既存）と
 * 同じ位置づけの補助手段として使う。UI操作の代替ではない——確定操作自体（キャンセルを試みる）・
 * 拒否理由の検証は常にUI経由で行う。
 *
 * この端末の予約ID（reservationId）は、モックの内部データ構造ではなく、製品の公開シンボル
 * `/src/api/myReservationsStore.ts` の `listMyReservations()`（この端末の有効な予約のレコード配列を
 * 返す）から取得する。localStorageを直接読むのではなく、製品側のアクセサ経由で行う。
 */
export async function cancelReservationInBackground(
  page: Page,
  criteria: { roomId: string; date: string; startTime: string; endTime: string },
): Promise<void> {
  const result = await page.evaluate(async (c) => {
    const storeMod = await import("/src/api/myReservationsStore.ts");
    const mine = storeMod.listMyReservations();
    const target = mine.find(
      (r) =>
        r.roomId === c.roomId &&
        r.date === c.date &&
        r.startTime === c.startTime &&
        r.endTime === c.endTime,
    );
    if (!target) {
      return {
        ok: false as const,
        reason: "reservation not found in this device's record",
      };
    }
    const reservationsMod = await import("/src/api/reservations.ts");
    return reservationsMod.cancelReservation(target.reservationId);
  }, criteria);
  if (!result.ok) {
    throw new Error(
      `cancelReservationInBackground: キャンセルに失敗した(テストデータ不正の可能性): ${JSON.stringify(result)}`,
    );
  }
}
