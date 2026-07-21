# reservation-frontend

会議室予約フロントエンド。**現時点は受け皿（スキャフォールド）のみ**で、契約スライスの実装は
まだ含まない。契約・スライスの状況は `activeContext.md` を参照。

## スタック

- Vite + React + TypeScript（`adr/0003-select-typescript-react-vite-stack.md`）
- Tailwind CSS v4（`@tailwindcss/vite`）
- shadcn/ui（Radix UI base、neutral系ベースカラー、`adr/0005-select-shadcn-ui-design-system.md`）
- lucide-react（アイコン）
- ESLint + Prettier 相当のTS向けlint（`eslint.config.js`。ADR-0003のL1ツール選定に合わせている）

`@/*` は `src/*` を指すパスエイリアス（`tsconfig.app.json` と `vite.config.ts` の両方に設定済み）。

## ディレクトリ規約

`projects/reservation-system`（バックエンド）の規約に倣い、プロジェクト直下を実装コードの
ルートとする（`app/` 等のネストなし）。既存の `adr/` `contracts/` `design/` `activeContext.md`
`friction-log.md` と、Viteアプリのファイル一式（`src/` `index.html` `package.json` 等）が
同じ階層に共存する。

```
reservation-frontend/
├── adr/                 既存: ADR（読み取り専用、developerは変更しない）
├── contracts/            既存: 契約（feature等、読み取り専用）
├── design/                既存: designerの成果物置き場
├── activeContext.md      既存
├── friction-log.md       既存
├── src/                  Viteアプリのソース
│   ├── components/ui/    shadcn/uiのcopy-inコンポーネント
│   ├── design-preview/   デザイン成果物の受け入れ口（下記参照）
│   ├── lib/               shadcn/ui用ユーティリティ（cn等）
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig*.json
```

## デザイン成果物の受け入れ口

外部AI（designer役、meta/adr/0018・0019）が返すTSXコンポーネントは、**変容させずに実プロジェクト
で描画してレビューする**ために `src/design-preview/` に置く。詳細は
`src/design-preview/index.tsx` 冒頭のコメントを参照。

成果物が `@/components/ui/...`（shadcn/uiのcopy-inコンポーネント）をimportする前提で書かれて
いれば、このプロジェクトに実体がすでにあるため変更なしに解決される。現時点では
`src/design-preview/index.tsx` はプレースホルダを表示するのみ。

導入済みのshadcn/uiコンポーネント: card, button, badge, dialog, tabs, input, label, select,
popover, calendar, sheet, scroll-area, sonner (toast), separator。

## セットアップ

```bash
npm install
npm run dev      # 開発サーバ起動
npm run build    # 型チェック + 本番ビルド
npm run lint     # ESLint
```
