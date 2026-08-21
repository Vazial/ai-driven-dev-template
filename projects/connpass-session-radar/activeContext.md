# activeContext.md — Connpass Session Radar

> P-11: このファイルは常に現在だけを映す。履歴はgitとADRが持つ。

## 現在

connpassの条件に合うイベントを毎朝1通届ける、画面・永続状態を持たないパイプラインである。興味条件は
リポジトリ内のYAML、通知先はSlack Incoming Webhook、起点はGitHub Actionsのスケジュール実行、対象期間は
`windowDays`である（ADR-0001）。外部I/Oはconnpass API v2の取得と通知だけで、NotifierPortは将来の
通知先の差し替えを許す。

`daily-digest-test-support.yaml` v0.3は承認済みである。ADR-0002により既定NotifierをSlack Incoming
Webhookへ置き換え、実装もWebhook URLへ`text`を1回POSTするアダプターへ置換した。NotifierPortと
CSR-D-01〜10の振る舞いは変わらない。

CSR-D-01〜10実装とL4 translationは完了し、Slack置換後のorchestrator確認もL0 green、通常・UTC環境の
Node tests 17/17、syntax green、L4 CSR-D-01〜10 greenである。既存のreviewer監査対象だった
steps/DSLと受け入れbridgeは変更していない。
すべてのCSR-Dシナリオから`@pending-implementation`を外している。

## 保留・外部事実

- APIキーは発行済みだが、値は読まず、保存・使用もしていない。
- `ymd`の複数値がOR結合するかは、まだ実測していない。
- プロジェクト専用CIはL1→L4を直列実行する。scheduled workflowは毎日08:00
  `Asia/Tokyo`に設定し、手動実行も許す。scheduleはGitHubの仕様上、mainへの昇格後に既定ブランチの
  最新版として動く。GitHub Secretsへの`CONNPASS_API_KEY`・`SLACK_WEBHOOK_URL`登録状態は未確認であり、
  実プロバイダへの接続もまだ行っていない。
- 次はテスト用Slackチャンネルへ実送信し、人間が受信内容を確認する。確認が終わるまで実装PRもmain昇格も
  マージしない。`ymd`複数値のOR結合も、実connpass API確認時に実測する。
