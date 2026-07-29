# activeContext.md — 会議室予約フロントエンド

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 役割（meta/adr/0033）: このファイルは **reservation-frontend 内部**の状態のみを持つ。テンプレ管理・全プロジェクト・**クロスプロジェクトの状態はリポジトリ直下の `activeContext.md`（ルート）が唯一の所有者**。跨り事実はここに複製せず、ルートを参照する。
> 最終更新: 2026-07-29

## 今どこにいるか

**rooms・availability の実バックエンド接続が完了した**（PR #35、2本目＝ADR-0009 決定6(b)）。`GET /rooms`（adr/0009）に続き `GET /rooms/{roomId}/availability` を実接続。方式は環境変数で独立にopt-in（`VITE_USE_REAL_ROOMS_API`・`VITE_USE_REAL_AVAILABILITY_API`、既定モック）。検証ゲートは**層状の機械検証**（meta/adr/0032）——形の互換性＝SSoT yaml経由の推移的ゲート、配線＝`liveWiring.test.ts`、実モード分岐＝fetchモックの単体テスト。走破は安定ゲートにしない。L1/L4緑（Vitest 48件・ESLint・`tsc -b && vite build`・Playwright e2e）。

> 接続方式（Vite proxy・越境なし）・契約SSoT・consumer-driven の詳細は**ルート `activeContext.md` のクロスプロジェクト節**を参照（複製しない）。

実装の現状:
- 画面: RFE-A（空き状況タイムライン、`src/features/availability/`）・RFE-B（予約ダイアログ、`src/features/booking/`）実装済み。案B（adr/0006）の設計調整（予約者名非表示・空き/予約済みの二値表示）反映済み。
- 型: SSoT yaml から生成（adr/0008、`npm run gen:api` → `src/api/schema.d.ts`）。
- 実接続の範囲: **rooms・availability のみ**実API opt-in。**予約作成・キャンセル（`src/api/reservations.ts`）はモックのまま**。
- design-preview 隔離: 本番ビルドの entry を `index.html` に固定済み（adr/0022 §2、`design-preview.html` は dev 限定）。

## 確定した主要な判断（プロジェクトADR）

| ADR | 内容 | status |
|---|---|---|
| 0001 | シンプルCRUDパック | 承認済み |
| 0002 | 独立プロジェクト（reservation-system と非統合） | 承認済み |
| 0003 | TypeScript + React + Vite | 承認済み |
| 0004 | 画面モックを設計骨格承認に含める（§1§2 の条文改訂＝TSX方式への書換は未着手） | 提案中 |
| 0005 | shadcn/ui 採用 | 提案中 |
| 0006 | 案B（無認証・情報を絞る。案Cは将来オプション） | 承認済み |
| 0007 | フロント検証の運用・L3 defer | superseded |
| 0008 | 契約型は SSoT yaml から生成 | 承認済み |
| 0009 | `GET /rooms` を初の実接続（決定6(b) で availability へ2本目拡張） | 承認済み |

## 次にやること（プロジェクト内部）

1. **予約作成・キャンセルの実接続**（`reservations.ts` はモックのまま）。rooms・availability に続く実接続候補。結合ゲートは ADR-0032 の層状機械検証に倣う。
2. **「自分の予約」（端末ローカル/localStorage）スライス**（案B、adr/0006）— 未着手。
3. **骨格（おおまかなコンポーネント構成）の記述・保存・比較の実現**（改修ガバナンスの判定機構、meta/adr/0021）— 未着手・優先度高。レンダリング画像の記録は非ブロッキング宿題。
4. **ADR-0004・0005 の人間承認**、および ADR-0004 §1§2 の条文改訂（静的HTML/CSS → TSX＋受け皿方式）。
5. **`PATCH /reservations/{id}`（予約時間変更）の要否** — 未決（案内文を実態に合わせるか、機能追加するか）。
6. **design.md・ARCHITECTURE.md の新規作成**（architect、上記が揃い次第）。
7. refinement ループの反復回数N・escape hatch の優先順位（ADR-0004 §6）— 未定。

## 未解決の論点（プロジェクト内部）

- 利用者像（想定利用環境・利用者範囲）未確認。デザイン要件（既存社内デザインシステム/ブランドの有無）未確認＝ADR-0005 の前提。想定スタック制約（組織標準の有無）未確認＝ADR-0003 の前提。
- ADR-0004 §1§2 条文改訂の順序・タイミング。meta/adr/0021 の骨格記録・記録画像の置き場もここで定める。
- RFE-A契約（`contracts/availability-view.feature`）の人間承認。
- designer の refinement 反復・model 選定（opus 維持は architect 判断、meta/adr/0018）。

## 直近のfriction

FR-001〜007（`friction-log.md`、メタデータ付き）。designer関連（FR-001〜004）・control surface（FR-005）・生成ツール（FR-006）・部分的実接続の識別子空間分断（FR-007＝availability 実接続の動機）。多くは対応済み。詳細は `friction-log.md`。
