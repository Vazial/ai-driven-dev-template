# guardrails.md — 運用ガードレール規程

> 対象: 全agent、およびリポジトリ初期設定。
> 原則の根拠: P-04（ここに書かれた項目は、可能な限り設定として機械的に強制する。本文書は「何をなぜ強制しているか」の索引）

## 1. コミット・ブランチ

| 項目 | 内容 | 強制手段 |
|---|---|---|
| コミット規約 | Conventional Commits（feat / fix / refactor / test / docs / chore） | commitlint |
| ブランチ運用 | `main`をリリース可能なブランチ、`project/<project>`を各プロジェクトの統合ブランチとする。1スライス=対応する `project/<project>`から切る1短命ブランチ=1PR（baseは `project/<project>`）。`project/<project>`から`main`へのPRで、そのプロジェクトのリリース可能なまとまりを昇格する。命名は `<type>/<project>-<slice>`（共有ガバナンスは例外的に `meta/<slug>`でmainをbaseとする）。meta/adr/0026 決定2、meta/adr/0028 | 運用 + PRテンプレ + branch protection |
| AIができること | ブランチ作成（スライス短命ブランチ、および `project/<project>`統合ブランチ＋保護rulesetの作成。admin権限が要る。meta/adr/0028）、コミット、PR作成 | — |
| 人間のみができること | main・`project/<project>`へのマージ | branch protection |
| 禁止操作 | force push、main・`project/<project>`への直接push、ブランチ/タグの削除 | branch protection + agent権限設定 |

## 2. PR・CI

- PRテンプレート必須項目: 「対象契約（シナリオID）」「DoD充足のエビデンス（CI結果）」
- CI構成（meta/adr/0026 決定1）: L0（govlint、`.github/workflows/govlint.yml`）はリポジトリ横断の共有ゲートで**常時実行・pathsフィルタなし**。各プロジェクトのL1〜L4は `.github/workflows/ci-<project>.yml` に分割し、自プロジェクト配下（`projects/<project>/**` と当該ワークフロー自身）の変更時のみ起動する。**新プロジェクトの参入は `ci-<project>.yml` を1本足すだけ**（共有ファイル・他プロジェクトのワークフローは編集しない）
- CI必須チェック（現状＝meta/adr/0026 決定1.3 の**案i**）: **L0（govlint）のみを hard-required** とする（全PRで必ず起動する共有ゲートのため required 化しても滞留しない）。各プロジェクトの L1 → L2 → L3 → L4（verification.md参照）は、pathsフィルタで無関係PRでは起動しないため**まだ required 化しておらず**、PR上で緑をレビュー時に目視確認する運用。将来 案ii（Rulesets のパス条件付き required）／案iii（ジョブ常時起動＋内部paths判定）で機械必須化に強化しうる。**pathsフィルタとrequired checksの噛み合わせ**（無関係PRで起動しないジョブがrequiredのまま滞留する既知の癖）の詳細は meta/adr/0026 決定1.3 参照。required checks一覧の変更は人間承認（meta/permissions.md「ゲート変更」）
- **配線・結合の検証ゲート（meta/adr/0032）**: 部品・プロジェクトを跨ぐ配線とデータ疎通は**機械検証で
  担保する**。agentが実スタックを手で起動して画面を目視する「ユースケース走破」を、この回帰ゲートに
  用いない（機械検証でない＝P-01違反／アドホックな起動は非再現）。走破は**未知の帰結の探索**と、**意味
  理解が要るUX・control surfaceの確認**（meta/adr/0024）に限る。層状のゲートの構成は
  meta/verification.md「L3詳細」および §3.4 を参照
- `main` はGitHub ruleset `protect main`（2026-07-27時点で有効）で保護されている。`project/<project>` はプロジェクト開始時に**AIが `gh` のadmin権限で GitHub Rulesets REST API（`gh api repos/:owner/:repo/rulesets`）を用いて作成し**、同じ保護（`pull_request`：PR経由のみ・直push不可／`non_fast_forward`：force push禁止／`deletion`：削除禁止／`required_status_checks`：`L0: 統治文書の整合(govlint)` を必須）をrulesetで設定する（`protect project/<project>` という名前、対象refは `refs/heads/project/<project>`。テンプレは既存の `protect main`・`protect project/toyama-weekend-radar` と同一。meta/adr/0028）。人間はプロジェクト開始をchatでauthorizeし作成結果を確認する。`project/reservation-frontend` はこの方式の初適用として作成済み（ブランチ＋ruleset `protect project/reservation-frontend`、2026-07-29。ADR-0028）。`project/toyama-dining-radar` も同じ方式で作成済み（ブランチ＋ruleset `protect project/toyama-dining-radar`、2026-07-30）。`project/reservation-system` は現時点で未作成である。rulesetの実体はGitHub設定（git管理外）に存在するため、作成・変更時は本行も更新する。

## 3. シークレット・破壊的操作

| 項目 | 強制手段 |
|---|---|
| `.env`・認証情報・秘密鍵はAI読み取り禁止 | agentのdeny設定（口頭ルールにしない） |
| 本番環境への操作、データ削除系コマンドの禁止 | agentに権限を与えない（credential分離） |
| 依存パッケージの追加はPR上で人間が差分確認 | PRレビュー + lockファイルのCODEOWNERS |

## 4. セッション・コンテキスト

- 全agentは起動時に PRINCIPLES.md + 自分の役割定義 + activeContext.md を読む
- activeContext.mdの更新タイミングと権限は permissions.md に従う
