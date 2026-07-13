# activeContext.md — テンプレート整備プロジェクト

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 最終更新: 2026-07-13 (templates/完了を反映)

## 今どこにいるか

A層の規程7ファイル + agents/の4agent定義 + templates/の6雛形が完成。ARCHITECTURE.md（設計の現在）の概念も追加済み。残る書き物はguardrails実体のみで、次はいよいよ予約システムへの初適用。

## 確定した主要な判断

- 正しさの保証は機械検証へ移す。人間の承認は4点に集約（契約 / 設計骨格 / step実装 / 規程変更）
- 3層構造: A層=メタ（言語非依存）/ B層=スタック・設計パック / C層=ドメイン
- 多段保証はL1〜L5の積層。失敗は下の段に押し込む
- agentは4役: architect / developer / tester / reviewer。tester（step作成）とreviewer（独立監査・対訳表）は分離する — 誤解の自己申告を防ぐため
- AI自律更新可はメモリ系3ファイル（本ファイル・friction log・ARCHITECTURE.md）。ARCHITECTUREは承認済み決定の投影のみ
- 配布はGitHubテンプレートリポジトリで開始、3プロジェクト目からパッケージ参照方式を検討

## 進行中 / 次にやること

1. guardrails/ の実体（branch protection・deny設定・CI設定）← 初適用と同時進行でも可
2. 予約システムへの初適用 + friction log 開始

## 未解決の論点

- 設計パック（B層）の実体はまだ1つも無い。初適用時に「ドメインモデルパック」から作り始める想定
- step定義lint（分岐禁止・行数上限）の具体的な実現手段が未調査
- L5のブラウザ操作agent（Playwright MCP）の組み込み方が未設計

## 直近のfriction

- （まだ記録なし。予約システム初適用から運用開始）
