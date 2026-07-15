# meta/ — A層（メタ層）

言語・フレームワーク非依存の、AI駆動開発の基盤。全プロジェクトに適用される。

## 文書体系

| 種別 | ファイル | 性質 | 読者 |
|---|---|---|---|
| 信条 | PRINCIPLES.md | 不変（変更はADR必須）。1ページ | **全agentが常時ロード** |
| 規程 | permissions.md | 権限とエスカレーション | 全agent（成果物に触れる前） |
| 規程 | verification.md | 多段保証モデル | developer / reviewer、CI設計 |
| 規程 | architecture-selection.md | 設計パック選定 | architect（プロジェクト開始時） |
| 規程 | agents.md | agent役割分担と標準フロー | 全agent |
| 規程 | guardrails.md | 運用ルールの索引（実体は設定） | リポジトリ初期設定時 |
| 決定 | adr/ | A層自身の決定履歴（1決定1枚・編集禁止。meta/adr/0001） | 規程変更の提案・監査時 |
| 状態 | activeContext.md | 進捗の「今」。常に現在だけを映す（各プロジェクトのC層に置く） | 全agent起動時 |
| 状態 | design.md | 設計の「今」。境界・責務の地図（各プロジェクトのC層に置く。architectが維持） | architect / developer |

## agentの起動時コンテキスト

全subagentは「**PRINCIPLES.md（不変の信条）+ 自分の役割定義 + activeContext.md（現在の状態）**」の3点セットで起動する。
規程は役割・場面に応じて参照する。

## agentの役割

agents.md を参照（architect / developer / tester / reviewer の4役と分離の理由、標準フロー）。

## 未整備（今後の作業）

- [x] agents/ — subagent個別定義（architect / developer / tester / reviewer。設計はagents.md）
- [x] templates/ — adr / pull-request / audit-report / friction-log / active-context / architecture / acceptance-scenario の7雛形
- [x] guardrails/ — branch protection・deny設定・CI設定の実体ファイル（.claude/settings.json、.github/workflows/ci.yml、guardrails/。CIの実コマンドはスライスRSV-Cで実装済み。step定義lintツールは未確定）
- [x] 検証: 予約システムプロジェクトへの初適用（スライスRSV-C完了・friction log運用中: FR-001〜005）
- [ ] B層: 設計パックの実体（最初の該当プロジェクト出現時に作る。パック例はarchitecture-selection.md 4節）
