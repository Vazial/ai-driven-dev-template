# activeContext.md — 会議室予約フロントエンド

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 役割（meta/adr/0033）: このファイルは **reservation-frontend 内部**の状態のみを持つ。テンプレ管理・全プロジェクト・**クロスプロジェクトの状態はリポジトリ直下の `activeContext.md`（ルート）が唯一の所有者**。跨り事実はここに複製せず、ルートを参照する。
## 今どこにいるか

**予約作成（`POST /reservations`）の実バックエンド接続が完了した**（3本目。`GET /rooms`＝adr/0009、`GET /rooms/{roomId}/availability`＝adr/0009 決定6(b) に続く）。**初の「書き込み」の実接続**であり、読み取り2本とは次の点が違った:

- **proxy ルールの新設が必要**だった。`/reservations` は既存の `/rooms` プレフィックスの前方一致でカバーされない（availability は `/rooms/{id}/availability` なので無料でカバーされていた）。`liveWiring.test.ts` がこの配線を機械ゲートする。
- **部分的な実接続が「書き込み結果の可視性」を分断する**（FR-007＝識別子空間の分断と同型の別種）。予約作成だけ実APIにすると、作成した予約は実バックに入りモック側のタイムラインには現れない。対処もFR-007と同じ——フラグは1本ずつ独立に保ち（adr/0009 決定1）、「実用上は3つ同時に true でないと通しで機能しない」制約をコードに明記した。
- **確定操作に例外の受けが必要**だった。実モードでは `createReservation` が throw しうる（adr/0009 決定4）が、`BookingDialog.handleConfirm` に catch が無く、バック未起動時にクリックが無反応になる穴があった。汎用の失敗表示に落とすよう修正し、回帰テストを追加した（修正を外すと落ちることを確認済み）。
- **契約とモックの差を意図的に埋めていない**: 契約は `POST /reservations` に **404 を定義していない**（201/409/422のみ）。モックは存在しない会議室を ROOM_NOT_FOUND で拒否するため、実モードでは同じ状況が汎用の失敗（例外）になる。埋めるには契約側に404を足す＝人間承認の要る契約変更なので、実装側で勝手に解釈しない（adr/0009 決定4）。

検証ゲートは**層状の機械検証**（meta/adr/0032）——形の互換性＝SSoT yaml経由の推移的ゲート、配線＝`liveWiring.test.ts`、実モード分岐＝fetchモックの単体テスト。走破は安定ゲートにしない。L1/L4緑（Vitest 56件・ESLint・`tsc -b && vite build`・Playwright e2e 4件）。

> 接続方式（Vite proxy・越境なし）・契約SSoT・consumer-driven の詳細は**ルート `activeContext.md` のクロスプロジェクト節**を参照（複製しない）。

実装の現状:
- 画面: RFE-A（空き状況タイムライン、`src/features/availability/`）・RFE-B（予約ダイアログ、`src/features/booking/`）実装済み。案B（adr/0006）の設計調整（予約者名非表示・空き/予約済みの二値表示）反映済み。
- 型: SSoT yaml から生成（adr/0008、`npm run gen:api` → `src/api/schema.d.ts`）。
- 実接続の範囲: **rooms・availability・予約作成の3本**が実API opt-in（`VITE_USE_REAL_ROOMS_API`・`VITE_USE_REAL_AVAILABILITY_API`・`VITE_USE_REAL_RESERVATIONS_API`、いずれも既定モック）。
- **キャンセルは未着手**（API関数・UI・受け入れシナリオのいずれも無い）。バック側は RSV-K が完成済みなので、足りていないのはフロントだけ。
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

1. **キャンセル ＋「自分の予約」（端末ローカル/localStorage）スライス**（案B、adr/0006）— 未着手。**これは実接続作業ではなく新規スライス**であり、受け入れシナリオの起草（architect）→ 人間承認 → tester/developer 並行、という標準フローが要る。現在の契約は RFE-A（3件）・RFE-B（3件）の6シナリオのみで、キャンセルのシナリオは存在しない。
2. **`.env.example` に `VITE_USE_REAL_RESERVATIONS_API` を追記する** — 未実施。Claude Code の権限設定が `.env*` の読み取りを拒否するため（guardrails §3、意図されたガード）、このファイルだけAIが触れなかった。人間または別ランタイムが追記する。
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
