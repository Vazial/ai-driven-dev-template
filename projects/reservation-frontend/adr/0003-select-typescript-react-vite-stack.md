---
id: 0003
scope: project/reservation-frontend
status: 承認済み
date: 2026-07-18
approved_by: "人間承認"
supersedes: []
superseded_by: null
relates_to: [P-09]
---
# ADR-0003: 実装スタックとしてTypeScript + React + Viteを採用する

## 文脈

ADR-0001でシンプルCRUDパック（フロントエンド版）を選定した。パックの必須部品（構造検証・テスト戦略・
CI実コマンド）を具体化するには実装スタックの確定が必要。meta/verification.md はL1の単体テスト例として
「Vitest」を挙げ（2節）、段×手段対応表（4節）でフロントエンドのL3を「同一API仕様→クライアント/型生成」、
L4を「E2E（主要フローのみ）」と定めており、TypeScriptエコシステムでの実現が最も摩擦が少ない。

**前提の明記**: 本ADRは、組織として既存のフロントエンド技術資産・標準スタックの指定が無いことを前提に
している。もし社内で標準化されたフロントエンド技術（例: 特定フレームワークの指定、モバイルアプリとして
の提供、アクセシビリティ基準、対応ブラウザの下限）が別途あるなら、本ADRは差し戻して再検討が必要
（activeContext.mdの「未解決の論点」に人間確認事項として記載済み）。

## 決定

TypeScript + React + Vite を採用する。多段保証の各段のツールは以下とする:

| 段 | ツール |
|---|---|
| L1 | Vitest + Testing Library（単体・コンポーネント）、ESLint + Prettier（lint） |
| L2 | ESLint境界ルール（例: eslint-plugin-boundaries）またはdependency-cruiser（依存方向: screens→api-client / screens→shared、逆流禁止をADR-0002の構成規約通りに強制） |
| L3 | openapi-typescript等によるreservation-api.yamlからの型・クライアント自動生成（手書き禁止。生成コマンドをCIで実行し差分ゼロを確認） |
| L4 | Playwright（E2E。主要フローに限定。steps/dslの4層分離はverification.md L4詳細に従う） |
| L5 | Playwright（Visual Regression Testingおよびブラウザ操作agentによる確認） |

## 検討した代替案

- 案A: Vue + Vite / 不採用の理由: React・Vueいずれも要件を満たせるが、openapi生成ツール・Playwright
  連携の実績で決定的な差はない。今回はより広く採用されているReactを選び、学習・保守コストの見積もり
  やすさを優先した。組織の他プロジェクトでの利用実績が判明すれば判断が覆りうる
- 案B: フレームワークなし（Vanilla TypeScript + Web Components） / 不採用の理由: ADR-0001の「層を
  圧縮する」方針とは別に、フォーム状態管理・画面遷移をすべて自前で書くコストが増え、かえって「薄い
  サービス層」に徹する狙いから逸れる
- 案C: Next.js（SSRフレームワーク） / 不採用の理由: 現時点でSSR・SEOの要件が明示されていない（社内
  ツール想定）。要件が明らかになった場合は再検討する

## 帰結

- 良い影響: verification.mdが既に示すツール例（Vitest）とそのまま整合し、L1〜L5の全段に成熟したツール
  が揃う。契約からの生成物を使うため、API仕様の変更が型エラーとして機械的に検出できる（L3）
- トレードオフ: 生成コマンドの実行・差分検査をCIに組み込む初期コストが要る。案Aとの差は決定的ではなく、
  組織の標準スタックが判明した場合は覆る可能性がある
- 波及する作業: プロジェクトの初期化（package.json等）、CI（.github/workflows/ci.yml）への実コマンド
  追加、design.md/ARCHITECTURE.mdへの反映（いずれもADR承認後にarchitectが着手）
