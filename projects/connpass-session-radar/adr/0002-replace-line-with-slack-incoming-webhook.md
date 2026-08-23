---
id: 0002
scope: project/connpass-session-radar
status: superseded
date: 2026-08-22
approved_by: "本PRのマージをもって承認（ADR-0035 方式(i)。人間裁定 2026-08-22 chat: LINEを廃止しSlackへ切り替える。固定チャンネルへの毎朝1通にはIncoming Webhookを採用する）"
supersedes: []
superseded_by: 0003
relates_to: [P-01, P-02, P-05, P-08, P-09, P-11, ADR-0001, CSR-D-01, CSR-D-03, CSR-D-04]
---

# ADR-0002: 既定の通知先をSlack Incoming Webhookへ置き換える

> **（2026-08-22 追記。`adr/0003`）** 本ADRのSlack Incoming Webhook決定は、実運用前に`adr/0003`の
> Discord Webhook決定へ置き換えられた。実Slack送信とprojectブランチへのSlack実装マージは行われていない。

> **承認者向けサマリ**: ADR-0001の決定2だけを置き換え、既定のNotifierをLINE Messaging APIから
> **Slack Incoming Webhook**へ変更する。固定された1チャンネルへ毎朝1通送る現在の用途では、Webhook URL
> 1個をsecretとして持ち、`text`を含むJSONをPOSTするだけで成立する。`NotifierPort`、`DailyDigest`、
> CSR-D-01〜10、GitHub Actionsの08:00実行、興味条件YAMLは変更しない。このPRのマージが本決定と、
> それを投影したproduct brief・契約注記・設計文書の再承認になる。

## 文脈

ADR-0001は「普段使いとの整合」を優先してLINE Messaging APIのbroadcast送信を選んだ。その後、実装と
自動検証は完了したが、main昇格前の実通信レビューでLINE公式アカウントとbroadcast送信を運用することを
人間が望まないと判断し、Slackへの変更を指示した。実LINE送信は一度も行っておらず、既存利用者や移行
対象データは無い。

現在の配信は一人が読む固定チャンネルへの朝1通であり、送信先の動的変更、投稿後の更新・削除、スレッド
返信、対話操作を必要としない。Slack公式仕様ではIncoming Webhookは、アプリをインストールするときに
選んだチャンネル固有の秘密URLへJSONをPOSTしてメッセージを送る。Webhook URLは秘密として扱う必要が
あり、Incoming Webhookから投稿したメッセージは削除できない。

一次情報:

- Slack, “Sending messages using incoming webhooks”
  <https://api.slack.com/messaging/webhooks>（2026-08-22確認）
- Slack, “chat.postMessage method”
  <https://api.slack.com/methods/chat.postMessage>（2026-08-22確認）

## 決定

### 1. 既定NotifierをSlack Incoming Webhookにする

実行環境は`SLACK_WEBHOOK_URL`をGitHub Actions secretから受け取る。NotifierはそのURLへ
`Content-Type: application/json`で、受信者向けに整形済みの一覧を`text`として1回POSTする。HTTP 2xxだけを
配信成功とし、それ以外と通信例外は`delivered=false`へ変換する。Webhook URL、Slackの生レスポンス、
内部例外を受信者向け要約やログへ出さない。

Webhook URLは送信先チャンネルに結び付くため、チャンネルIDやBot tokenは別に持たない。テスト用と本番用で
送信先を分ける場合は、それぞれのチャンネルに対応するWebhook URLを実行環境側で差し替える。

### 2. 配信先非依存の境界と振る舞いを維持する

`NotifierPort`の入力`DailyDigest`と出力`NotifierResult`は変更しない。取得、絞り込み、算出、整形にも
変更を加えない。CSR-D-01〜10の「通知先に1通届く」「0件と分かる」「安全な失敗要約が届く」という
振る舞いはSlackでも同じである。プロバイダー固有のHTTP形式はアダプター内だけに閉じる。

### 3. main昇格前に実通信を人間が確認する

自動テストだけではSlack上の可読性と実際の権限設定を保証できない。テスト用SlackチャンネルのWebhookを
安全なローカル経路またはGitHub secretで設定し、実connpass APIから取得した一覧を1通送る。人間が
Slack上で内容を確認するまでmainへの昇格を行わない。実行時に`ymd`複数値の結合挙動も観測する。

## 置き換える範囲

ADR-0001は4つの決定を持つため、ファイル全体を`superseded`にはしない。本ADRが置き換えるのは決定2の
「既定NotifierはLINE Messaging API」という部分だけである。パイプラインパック、GitHub Actionsの
スケジュール実行、`windowDays`をYAMLに置く決定は引き続き有効である。ADR-0001には本ADRを指す追記だけを
加え、過去の判断本文は書き換えない。

## 検討した代替案

- **LINE Messaging APIを維持** / 不採用: main昇格前の実通信レビューで人間が運用しないと判断した。
- **Slack Web API `chat.postMessage`** / 不採用: Bot token、`chat:write` scope、channel指定を持てるが、
  今回不要な動的送信先や高度な操作のために設定面を増やす。
- **Slack Incoming Webhook** / 採用: 固定チャンネルへの一方向通知に必要な能力だけを持ち、秘密はWebhook
  URL 1個で済む。

## 帰結

- LINE公式アカウント、チャンネルアクセストークン、broadcast APIは不要になる。
- `SLACK_WEBHOOK_URL`はconnpass APIキーと同じくGitへ置かず、ログにも出さない。
- Incoming Webhookの投稿は本システムから削除できない。誤送信時の削除能力が必要になった場合は、
  `chat.postMessage`等への再変更を新しい判断として扱う。
- ADR・契約の承認後、Slackアダプター、環境変数、workflow、単体テストを実装し直す。
