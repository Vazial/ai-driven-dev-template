# activeContext.md — 会議室予約フロントエンド

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 役割（meta/adr/0033）: このファイルは **reservation-frontend 内部**の状態のみを持つ。テンプレ管理・全プロジェクト・**クロスプロジェクトの状態はリポジトリ直下の `activeContext.md`（ルート）が唯一の所有者**。跨り事実はここに複製せず、ルートを参照する。
## 今どこにいるか

**RFE-C「自分の予約を確認してキャンセルできる」のモック実装が完了した**（契約は人間承認済み＝PR #49、2026-07-30）。標準フロー（meta/agents.md §4）を全段踏んだ初のスライス——architect（契約）→ 人間承認 → developer と tester を**互いのcontextを共有せず並行** → reviewer の独立監査 → 人間承認。

検証: L1 Vitest 79件緑・ESLint緑・`tsc -b && vite build` 緑・L4 Playwright 9件緑。

**このスライスで reviewer の独立監査が機能した**: RFE-C-05 の e2e が落ちた際、orchestrator は「モックの状態スコープの分断で L4 では実現不能」と診断し先送りを提案したが、**reviewer が独立に「tester側の構成の問題であり実現可能」と反証し、そちらが正しかった**。原因は orchestrator が tester に与えた指示（「2ページ構成で作れ・既存 seam は使うな」）で、2ページでは端末記録（localStorage、ページ間共有）と予約台帳（`MOCK_RESERVATIONS`、モジュール変数＝ページごと）のスコープ差により `RESERVATION_NOT_FOUND` に落ちる。正しい作り方は**同一ページで既存の seam パターンを使い、台帳だけを先にキャンセルして一覧を更新させない**こと——モックAPIの `cancelReservation` は台帳のみ更新し端末記録に触らないため、「別の画面で既にキャンセルされたが、この一覧はまだ知らない」状態が忠実に再現できる。RFE-B-03（別の予約者が先に予約した）が同じ seam を使っているのと同型だった。

> 前スライス（予約作成の実接続）の経緯・proxy新設・例外の受け・契約とモックの404差は git と PR が持つ。ここでは繰り返さない（P-11・ADR-0034）。

> 接続方式（Vite proxy・越境なし）・契約SSoT・consumer-driven の詳細は**ルート `activeContext.md` のクロスプロジェクト節**を参照（複製しない）。

実装の現状:
- 画面: RFE-A（空き状況タイムライン、`src/features/availability/`）・RFE-B（予約ダイアログ、`src/features/booking/`）・RFE-C（自分の予約Sheet、`src/features/my-reservations/`）実装済み。案B（adr/0006）の設計調整（予約者名非表示・空き/予約済みの二値表示）反映済み。
- 型: SSoT yaml から生成（adr/0008、`npm run gen:api` → `src/api/schema.d.ts`）。
- 実接続の範囲: **rooms・availability・予約作成の3本**が実API opt-in（`VITE_USE_REAL_ROOMS_API`・`VITE_USE_REAL_AVAILABILITY_API`・`VITE_USE_REAL_RESERVATIONS_API`、いずれも既定モック）。
- **キャンセル（RFE-C）はモック実装まで完了**（`src/api/reservations.ts` の `cancelReservation`、判定ロジックは `src/api/cancellationLogic.ts` に分離。RSV-Kの422 CANCEL_DEADLINE_PASSED・409 ALREADY_CANCELLEDのみ対象、契約解釈ポイント(2)(3)）。実バックエンド接続（4本目のopt-in）は別スライスで未着手。
- 「自分の予約」は端末ローカル記録（`src/api/myReservationsStore.ts`、`localStorage`、案B adr/0006）で管理する。キャンセル成功後も記録は論理削除にとどめ物理削除しない（解釈ポイント(3-2)、人間裁定2026-07-30）。RFE-B（`BookingDialog.tsx`）が予約成立時にこの記録へ追加する接続を持つ。
- 現在時刻の判定は呼び出し時点で `new Date()` を評価する（モジュール読み込み時に固定しない）。単体テストは `vi.setSystemTime` で制御する。
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

1. **キャンセルの実バックエンド接続（4本目のopt-in）**。`POST /reservations/{reservationId}/cancel` を rooms・availability・予約作成と同じパターンで実接続する。proxy は `/reservations` ルールが既にあるので新設不要。
2. **（解決済み・2026-07-30）環境変数テンプレートの保守** — `.env.example` は **`env.example` にリネーム**され（meta/adr/0040）、AIが保守できるようになった。3本目・4本目で漏れていた `VITE_USE_REAL_RESERVATIONS_API`・`VITE_USE_REAL_RESERVATIONS_CANCEL_API` は追記済み。4本すべてを `true` にして初めてループが実物で通る、という組み合わせ制約も明記した。
3. **骨格（おおまかなコンポーネント構成）の記述・保存・比較の実現**（改修ガバナンスの判定機構、meta/adr/0021）— 未着手・優先度高。レンダリング画像の記録は非ブロッキング宿題。
4. **ADR-0004・0005 の人間承認**、および ADR-0004 §1§2 の条文改訂（静的HTML/CSS → TSX＋受け皿方式）。
5. **`PATCH /reservations/{id}`（予約時間変更）の要否** — 未決（案内文を実態に合わせるか、機能追加するか）。
6. **design.md・ARCHITECTURE.md の新規作成**（architect、上記が揃い次第）。
7. refinement ループの反復回数N・escape hatch の優先順位（ADR-0004 §6）— 未定。

## 未解決の論点（プロジェクト内部）

- **「自分の予約」を端末ローカルに持つ構造への違和感（人間提起 2026-07-30。adr/0006 の再検討候補）**: 予約の正はサーバにあるのに「どれが自分のか」だけクライアントが握っている。端末を変えると見えず、データを消すとキャンセル手段を失う（予約はサーバに残る）。**これは localStorage という手段の問題ではなく「無認証」の帰結**である——案B が `GET /reservations?reserverId=` を不採用にした（無認証では他人のIDで覗ける）結果、サーバに問い合わせる手段が無く端末に影を持つしかない。無認証のまま端末記録を消すには予約番号を利用者に持たせる方式しかなく、その場合「自分の予約一覧」画面自体が成立しない（承認済み骨格が変わる）。影を消すには **案C（軽量認証）**が要り、adr/0006 の再検討＋バックエンド契約の追加＝**越境スライス**（meta/adr/0023）になる。**RFE-C-05 の L4 が落ちたのも同じ構造**（サーバ役の状態が端末の状態より狭い）。人間の方針は「順番に対応する・今のスコープは案Bで閉じる」。
- 利用者像（想定利用環境・利用者範囲）未確認。デザイン要件（既存社内デザインシステム/ブランドの有無）未確認＝ADR-0005 の前提。想定スタック制約（組織標準の有無）未確認＝ADR-0003 の前提。
- ADR-0004 §1§2 条文改訂の順序・タイミング。meta/adr/0021 の骨格記録・記録画像の置き場もここで定める。
- RFE-A契約（`contracts/availability-view.feature`）の人間承認。
- designer の refinement 反復・model 選定（opus 維持は architect 判断、meta/adr/0018）。

## 直近のfriction

FR-001〜007（`friction-log.md`、メタデータ付き）。designer関連（FR-001〜004）・control surface（FR-005）・生成ツール（FR-006）・部分的実接続の識別子空間分断（FR-007＝availability 実接続の動機）。多くは対応済み。詳細は `friction-log.md`。
