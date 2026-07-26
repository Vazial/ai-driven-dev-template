import { defineConfig, devices } from "@playwright/test";

// L4相当（meta/verification.md・reservation-frontend/adr/0007）: Playwright E2E。
//
// 対象は本番アプリ（design-previewではなく `/` = AvailabilityScreen、meta/adr/0022 §2）。
// バックエンドは叩かない（src/api/ のモックのみで完結、meta/adr/0023）。
//
// webServerに `npm run dev`（Vite開発サーバ）を選ぶ理由: RFE-B-03（二重予約は拒否される）は
// 「予約ダイアログを開いた後に、別の予約者が先に予約を確定する」という状態を検証対象にする
// （contracts/reservation-booking.feature）。このアプリはバックエンドを持たず、予約台帳
// （MOCK_RESERVATIONS）はブラウザのJSモジュールインスタンス内にのみ存在するため、「ダイアログを
// 開いた後の競合」を安定的に再現するには、そのモジュールインスタンスに対して直接
// 予約を1件作成する必要がある（e2e/reservation-booking.spec.ts 参照）。Vite開発サーバは
// ソースファイルをそのままのパス（例: /src/api/reservations.ts）でESモジュールとして配信するため、
// テスト側から同じ specifier を動的importすれば、アプリが読み込み済みの「同一モジュールインスタンス」
// （したがって同一のMOCK_RESERVATIONS配列）に到達できる。`npm run preview`（本番ビルド）は
// バンドル・パス変換されるため、この経路は成立しない。
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "html",
  use: {
    baseURL: "http://localhost:5183",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5183 --strictPort",
    url: "http://localhost:5183",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
