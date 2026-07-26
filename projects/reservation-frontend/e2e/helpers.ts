import type { Page } from "@playwright/test";

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
