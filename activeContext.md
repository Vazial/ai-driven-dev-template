# activeContext.md（ルート） — テンプレ管理・全プロジェクト・クロスプロジェクト

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 役割（meta/adr/0033）: テンプレ自身の方法論の現在／全プロジェクトの一覧・状態／プロジェクト間の協調状態を持つ。
> **クロスプロジェクトの状態はこのファイルが唯一の所有者**。プロジェクト内部の状態は各 `projects/<p>/activeContext.md` が持つ（跨り事実は複製せずここを参照する）。
## テンプレ管理の現在

AI駆動開発のメタテンプレート。正しさを機械検証（L0〜L5）に置き、人間承認を4点（契約／設計骨格／step実装／規程変更）に集約する。ClaudeとCodexが同一リポジトリを並行開発する（meta/adr/0036、`meta/agent-runtime-mapping.md`）。

**ブランチ運用（meta/adr/0028、承認済み）**: `main`＝リリース可能。`project/<project>`＝各プロジェクトの長期統合ブランチ。スライスは `project/<project>` から `<type>/<project>-<slice>` を切りPRで戻す。`project/<project>` の作成＋保護rulesetは**AIが `gh` の admin権限で自動作成**する（人間はchatでauthorize＋結果確認）。`meta/**` の共有ガバナンス変更は例外的に base=main（ADR-0026直列化）。

**直近で確定したメタ判断**:
- meta/adr/0031（承認済み）: クロスプロジェクト結合CIの置き場 `ci-integration.yml`（両プロジェクトpaths和集合で起動）を定義。必須方針は緩い運用（案i）から。実ジョブの中身はスライスに委譲。
- meta/adr/0032（承認済み）: 配線・結合の検証は機械化する。走破（ADR-0024）は「未知探索」と「意味理解の要る検証（control surface・UX・L5）」に限り、**安定した回帰ゲートにはしない**。**規程本体への織り込み完了**（`meta/verification.md` L3詳細＋§3.4＋L5手段＋対応表、`meta/guardrails.md` §2、`meta/agents.md` 断面②検証）。
- meta/adr/0033（承認済み）: activeContextを2階層に（ルート＝テンプレ管理・全プロジェクト・跨り／プロジェクト内＝そのプロジェクト）。本ファイルがルート。
- meta/adr/0034（承認済み）: activeContext更新をPRテンプレDoDの必須チェック（関所）に載せ、accretion（追記肥大）を禁じ、手書き「最終更新」日付を廃止（gitが持つ）。
- meta/adr/0036（承認済み）: `.claude/agents/<role>.md` をClaude/Codex共通の唯一の役割定義原本とし、重複していた `meta/agents/<role>.md` を廃止した。runtime別のモデル選択は `meta/agent-runtime-mapping.md` が持つ。

**進行中のメタ論点・宿題**:
- meta/adr/0035（承認済み）: ADRの承認記録をPR1本で閉じる。ADRを含むPRは承認方式を二択で明示し（**(i)マージ＝承認**＝起草時に `status: 承認済み` ＋ `approved_by` を書く・既定／**(ii)記録のみ・承認は後日**＝意図した保留に限る）、滞留はgovlintの `[REPORT] 提案中ADRの棚卸し`（経過日数つき）で可視化する。ERROR化はしない（意味判定。P-04）。FR-015が一次データ。
- **提案中のまま滞留しているADRが10本ある**（2026-07-29時点、最古11日。govlintのREPORTに毎回出る）。ADR-0035は一括承認しない方針のため、**人間が個別に判断する必要がある**。優先度が高いのは規程本体がすでに依存している2本——`meta/adr/0026`（ブランチ運用・CI構成を `meta/guardrails.md` が根拠にしている）と `meta/adr/0024`（走破。承認済みの `0032` が前提にしている）。
- meta/adr/0037（承認済み）: govlintのシナリオID検査の3欠陥を修正。参照の境界を**ASCIIで定める**（`\b` はPythonの `\w` がUnicodeを含むため日本語の助詞が続く参照を検出しなかった）／定義は**IDが行の主語**（続くのが行末かコロン）のときだけ（行頭の散文が実在しない定義を生んでいた）／**名前空間をリポジトリ全体で1つに**（ADR-0023/0025が認めるクロスプロジェクト参照が解決できなかった）。3点は互いに依存し同時に入れる必要があった。既存の定義36行は無変更で通り、重複検出が全体に効くため検査は**強くなる**。FR-017が一次データ。
- **採番の衝突回避が全体の責任になった**（ADR-0037決定3の帰結）: シナリオIDの名前空間がリポジトリ全体で1つになったため、同じIDを別プロジェクトで定義するとL0エラーになる。現状はプレフィックスがスライス固有（RFE-A/B/C・RSV-A/C/K/L/R）で実害なしだが、**新プロジェクト追加時にプレフィックスの重複を避ける**必要がある。
- 結合CIカテゴリの記述（ADR-0031帰結）の `meta/guardrails.md` §2「CI構成」への反映は、`ci-integration.yml` の実ファイルを作る実装スライスとセットで行う（ADR-0031が明示的にそう定めている）。
- per-project activeContextのスリム化（2階層モデルへ・ADR-0033/0034）: reservation-frontendは実施済み（PR #39）。**reservation-systemは未実施**（プロジェクトブランチ未作成のため、次回作業時にブランチ作成と同時）。

## 全プロジェクトの一覧・状態

| プロジェクト | 担当 | 状態 | 詳細 |
|---|---|---|---|
| reservation-system（会議室予約バックエンド） | Claude | 垂直スライス5本（RSV-C/K/A/R/L）完了・API一通り緑・main。現在の新規作業なし | `projects/reservation-system/activeContext.md` |
| reservation-frontend（会議室予約フロント） | Claude | availability実接続完了（PR #35、`project/reservation-frontend`）。rooms＋availability両方が実API opt-in。設計フェーズの宿題（design-preview隔離・骨格記録等）は残る | `projects/reservation-frontend/activeContext.md` |
| toyama-weekend-radar | Codex | 休止。foundationは`project/toyama-weekend-radar`に保持し、Dining Radarへ注力する | 同ブランチ上のactiveContext |
| toyama-dining-radar | Codex | 統合ブランチと保護ruleset作成済み。富山県庁周辺の月例ランチ会向け店舗提案のfoundation開始待ち | foundationスライスで`projects/toyama-dining-radar/activeContext.md`を配置 |

## クロスプロジェクトの協調状態

**reservation-frontend ⇄ reservation-system**:
- **consumer-driven契約**（meta/adr/0023）: フロントの設計がバックエンド契約の形を駆動してよい。両者が交わるのは「契約の形」と「E2E結合」の2点のみ。契約のSSoTは `projects/reservation-system/contracts/reservation-api.yaml`（meta/adr/0025）。フロントは型をここから生成する（reservation-frontend/adr/0008）。
- **実バックエンド接続**: `GET /rooms`（reservation-frontend/adr/0009、rooms実接続）と `GET /rooms/{roomId}/availability`（PR #35、2本目=決定6(b)）が接続済み。方式: Vite dev server proxyの `/rooms` ルール（前方一致でavailabilityもカバー）で同一オリジンに見せ、**バックエンドは無変更＝CORSを足さない＝越境なし**。各APIは環境変数で独立にopt-in（`VITE_USE_REAL_ROOMS_API`・`VITE_USE_REAL_AVAILABILITY_API`）、既定はモック。
- **結合の検証ゲート（meta/adr/0032）**: 形の互換性はSSoT yaml経由で両側が別々に機械ゲート済み。配線は軽量単体テスト（`liveWiring.test.ts`）で機械ゲート。走破は安定ゲートにしない。end-to-endの実スタック機械検証が要る時は `ci-integration.yml`（testcontainers、meta/adr/0031の置き場）を足す（未実装、P-05）。
