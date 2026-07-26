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
