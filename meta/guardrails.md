# guardrails.md — 運用ガードレール規程

> 対象: 全agent、およびリポジトリ初期設定。
> 原則の根拠: P-04（ここに書かれた項目は、可能な限り設定として機械的に強制する。本文書は「何をなぜ強制しているか」の索引）

## 1. コミット・ブランチ

| 項目 | 内容 | 強制手段 |
|---|---|---|
| コミット規約 | Conventional Commits（feat / fix / refactor / test / docs / chore） | commitlint |
| ブランチ運用 | trunk-based。1スライス=1短命ブランチ=1PR。命名は `<type>/<project>-<slice>`（meta scopeは例外的に `meta/<slug>`）。meta/adr/0026 決定2 | 運用 + PRテンプレ |
| AIができること | ブランチ作成、コミット、PR作成 | — |
| 人間のみができること | mainへのマージ | branch protection |
| 禁止操作 | force push、mainへの直接push、ブランチ/タグの削除 | branch protection + agent権限設定 |

## 2. PR・CI

- PRテンプレート必須項目: 「対象契約（シナリオID）」「DoD充足のエビデンス（CI結果）」
- CI構成（meta/adr/0026 決定1）: L0（govlint、`.github/workflows/govlint.yml`）はリポジトリ横断の共有ゲートで**常時実行・pathsフィルタなし**。各プロジェクトのL1〜L4は `.github/workflows/ci-<project>.yml` に分割し、自プロジェクト配下（`projects/<project>/**` と当該ワークフロー自身）の変更時のみ起動する。**新プロジェクトの参入は `ci-<project>.yml` を1本足すだけ**（共有ファイル・他プロジェクトのワークフローは編集しない）
- CI必須チェック（現状＝meta/adr/0026 決定1.3 の**案i**）: **L0（govlint）のみを hard-required** とする（全PRで必ず起動する共有ゲートのため required 化しても滞留しない）。各プロジェクトの L1 → L2 → L3 → L4（verification.md参照）は、pathsフィルタで無関係PRでは起動しないため**まだ required 化しておらず**、PR上で緑をレビュー時に目視確認する運用。将来 案ii（Rulesets のパス条件付き required）／案iii（ジョブ常時起動＋内部paths判定）で機械必須化に強化しうる。**pathsフィルタとrequired checksの噛み合わせ**（無関係PRで起動しないジョブがrequiredのまま滞留する既知の癖）の詳細は meta/adr/0026 決定1.3 参照。required checks一覧の変更は人間承認（meta/permissions.md「ゲート変更」）
- main の保護は GitHub の **ruleset「protect main」**（git外設定・2026-07-27設定）で実装: `pull_request`（main へは PR経由のみ・直push不可）／`non_fast_forward`（force push禁止）／`deletion`（削除禁止）／`required_status_checks`（`L0: 統治文書の整合(govlint)` を必須）。この設定はリポジトリ設定に存在しgit管理外のため、変更時は本行も更新する（meta/adr/0026 決定1.3 案ii が指摘する「ruleset設定の記録保守」）

## 3. シークレット・破壊的操作

| 項目 | 強制手段 |
|---|---|
| `.env`・認証情報・秘密鍵はAI読み取り禁止 | agentのdeny設定（口頭ルールにしない） |
| 本番環境への操作、データ削除系コマンドの禁止 | agentに権限を与えない（credential分離） |
| 依存パッケージの追加はPR上で人間が差分確認 | PRレビュー + lockファイルのCODEOWNERS |

## 4. セッション・コンテキスト

- 全agentは起動時に PRINCIPLES.md + 自分の役割定義 + activeContext.md を読む
- activeContext.mdの更新タイミングと権限は permissions.md に従う
