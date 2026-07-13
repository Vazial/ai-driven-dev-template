# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-13

## 今どこにいるか

A層テンプレートの初適用プロジェクト。リポジトリ初期構成、guardrails実体（.claude/settings.json・CI骨格・commit-msg hook・branch protection手順書・step定義lint調査）が完了。次はarchitectによるアーキテクチャ選定。

## 確定した主要な判断

- （まだなし。ADR-0001でアーキテクチャ選定を記録予定）

## 進行中 / 次にやること

1. architectによるアーキテクチャ選定 → ADR-0001（projects/reservation-system/adr/）
2. 最初の垂直スライス「予約を作成できる」で4agentフローを一周

## 未解決の論点

- 会議室予約システムのEventStorming・ADR・Gherkin素材の所在が未確認。architectが契約ドラフトを作る際の入力として人間に確認が必要
- branch protectionはリモートホスト未接続のため手順書のみ（guardrails/branch-protection.md）。実際の有効化はリモート接続後に人間が実施
- step定義lintの具体ツールは未確定（guardrails/step-definition-lint.md に調査結果）。ADR-0001でのスタック確定後にarchitect/developerが決定
- CI（.github/workflows/ci.yml）はL1〜L4のジョブ骨格のみ。実コマンドはスタック確定後に埋める

## 直近のfriction

- （まだ記録なし）
