# activeContext.md — Connpass Session Radar

> P-11: このファイルは常に現在だけを映す。履歴はgitとADRが持つ。

## 現在

connpassの条件に合うイベントを毎朝1通届ける、画面・永続状態を持たないパイプラインである。興味条件は
リポジトリ内のYAML、通知先はLINE Messaging API、起点はGitHub Actionsのスケジュール実行、対象期間は
`windowDays`である（ADR-0001）。外部I/Oはconnpass API v2の取得と通知だけで、NotifierPortは将来の
通知先の差し替えを許す。

v0.2のtest-support契約はPR #111のマージにより2026-08-21に人間承認済みである。実装スライスは別の
feature worktree/branchに存在する。独立した検証根拠はL0 green、Node tests 15/15、CSR-D-01〜10のL4 green。
reviewerはCSR-D-04のsecret-leak観測以外の翻訳をすべて受理している。

`contracts/daily-digest-test-support.yaml` v0.3.0-draftは、FETCH_FAILUREだけに固定のsynthetic private
canaryを加え、受信者向けfailure summaryにそのfake secret文字列が現れないことを観測する改訂である。
この契約改訂はADR-0043方式(i)により、PRのマージによる人間承認待ちである。`@pending-implementation`
タグはacceptance承認フローが完了するまで残る。

## 保留・外部事実

- APIキーは人間から発行済みと報告されたが、値は読まず、保存・使用もしていない。
- `ymd`の複数値がOR結合するかは、まだ実測していない。
- プロジェクト専用CIワークフローとGitHub Actionsのscheduled workflowは、いずれも未作成。
