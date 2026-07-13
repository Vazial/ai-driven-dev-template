# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-13

## 今どこにいるか

A層テンプレートの初適用プロジェクト。リポジトリ初期構成（meta/配置・.claude/agents/配置・本ファイル群の実体化）が完了。次はguardrails実体の作成とarchitectによるアーキテクチャ選定。

## 確定した主要な判断

- （まだなし。ADR-0001でアーキテクチャ選定を記録予定）

## 進行中 / 次にやること

1. guardrails実体の作成（.claude/settings.json・CI設定・commitlint・step定義lint方針）
2. architectによるアーキテクチャ選定 → ADR-0001
3. 最初の垂直スライス「予約を作成できる」で4agentフローを一周

## 未解決の論点

- 会議室予約システムのEventStorming・ADR・Gherkin素材の所在が未確認。architectが契約ドラフトを作る際の入力として人間に確認が必要
- guardrailsのbranch protectionは、本リポジトリにリモートホスト（GitHub等）が未設定のため、設定ファイル・手順書レベルに留める（実際の有効化はリモート接続後）

## 直近のfriction

- （まだ記録なし）
