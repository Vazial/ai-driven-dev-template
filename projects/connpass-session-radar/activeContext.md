# activeContext.md — Connpass Session Radar

> P-11: このファイルは常に現在だけを映す。履歴はgitとADRが持つ。

## 現在

connpassの条件に合うイベントを毎朝1通届ける、画面・永続状態を持たないパイプラインである。興味条件は
リポジトリ内のYAML、通知先はLINE Messaging API、起点はGitHub Actionsのスケジュール実行、対象期間は
`windowDays`である（ADR-0001）。外部I/Oはconnpass API v2の取得と通知だけで、NotifierPortは将来の
通知先の差し替えを許す。

`daily-digest-test-support.yaml` v0.3は承認済みである。CSR-D-01〜10の実装とL4 translationは完了し、
orchestratorによる独立確認はL0 green、Node tests 15/15、syntax green、L4 CSR-D-01〜10 greenである。
reviewerは全translationを受理し、承認材料は揃っている。人間によるstep/DSL承認が、実装PRでの唯一の
残る承認点である。すべてのCSR-Dシナリオから`@pending-implementation`を外した。

## 保留・外部事実

- APIキーは発行済みだが、値は読まず、保存・使用もしていない。
- `ymd`の複数値がOR結合するかは、まだ実測していない。
- プロジェクト専用CIワークフローとGitHub Actionsのscheduled workflowは、いずれも未作成。
