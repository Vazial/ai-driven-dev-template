/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      // 本番ビルドのエントリは index.html のみに固定する。design-preview.html（dev限定・
      // 査読用の受け皿への入口）は明示的にここへ含めない。これにより `vite build` の
      // 成果物（dist/）に design-preview（BookingDesign.tsx 等）が含まれないことを、
      // Viteの既定挙動任せにせず設定として固定する（meta/adr/0022 §2）。
      // design-preview.html は `npm run dev` の際、Viteの静的ファイル/HTML変換機能に
      // よりそのまま配信される（このinput指定の対象外でも動作に影響しない）。
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  server: {
    proxy: {
      // 実バックエンド接続の初適用（reservation-frontend/adr/0009 決定2、人間承認 2026-07-28）。
      // `GET /rooms`（reservation-system、既定ポート8080・context-pathなし）をdev serverの
      // proxyで同一オリジンに見せる。バックエンド側にはCORS設定を一切追加しない（越境なし、
      // meta/adr/0023）。opt-in（VITE_USE_REAL_ROOMS_API=trueの時のみ src/api/rooms.ts が
      // `/rooms` を実際に叩く）なので、この設定自体は常に有効でも既定のモック開発フローに
      // 影響しない。
      '/rooms': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // 実バックエンド接続の3本目（`POST /reservations`）。availability（2本目）は
      // `/rooms/{roomId}/availability` だったため上の `/rooms` ルールの前方一致で無料でカバーされたが、
      // `/reservations` はその外側にあるため独立したルールが要る。この配線の不変条件
      // （実fetchのパスが proxy プレフィックス配下にある＝越境が不要）は
      // src/api/liveWiring.test.ts が機械ゲートする（meta/adr/0032: 配線・結合は機械検証する）。
      '/reservations': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    // フロントのテスト基盤の最小構成（RFE-Aスライドで新設）。Vitest + React Testing
    // Library（Vite標準）。design-previewはテスト対象外（本番実装ではないため）。
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // e2e/ はPlaywright（L4相当、reservation-frontend/adr/0007）専用のテストランナー
    // (playwright.config.ts の testDir)。Vitest（L1）の対象外にする。
    exclude: ['**/node_modules/**', 'src/design-preview/**', 'e2e/**'],
  },
})
