---
id: 0003
scope: project/connpass-session-radar
status: 承認済み
date: 2026-08-22
approved_by: "本PRのマージをもって承認（ADR-0035 方式(i)。人間裁定 2026-08-22 chat: Slack案を取り止めDiscordへ切り替える。通常はEmbed、容量超過時は同一メッセージへ完全一覧を添付し、mentionを無効化する）"
supersedes: [0002]
superseded_by: null
relates_to: [P-01, P-02, P-05, P-08, P-09, P-11, ADR-0001, ADR-0002, CSR-D-01, CSR-D-03, CSR-D-04]
---

# ADR-0003: 既定の通知先をDiscord Webhookへ置き換える

> **承認者向けサマリ**: ADR-0002のSlack Incoming Webhook案を実運用前に取り止め、既定Notifierを
> **Discord Incoming Webhook**へ変更する。通常の一覧はEmbedとして1メッセージで送り、DiscordのEmbed
> 合計6,000文字を超える場合は、完全な一覧をUTF-8テキストファイルとして同じ1メッセージへ添付する。
> イベントは黙って省略せず、`allowed_mentions.parse=[]`で意図しないmentionを防ぐ。`NotifierPort`、
> `DailyDigest`、CSR-D-01〜10、08:00実行、興味条件YAMLは変更しない。このPRのマージが本決定と、
> それを投影したproduct brief・契約注記・設計文書の再承認になる。

## 文脈

ADR-0002は、LINEを使わないという人間判断を受けてSlack Incoming Webhookを選んだ。その契約は承認された
が、Slack実装はDraft PRのままprojectブランチへマージされておらず、実Slack送信も行っていない。その後、
人間が通知先をDiscordへ変更するよう指示した。移行対象となる通知、利用者データ、Slack投稿は存在しない。

Discord公式仕様ではIncoming WebhookはBotや追加認証なしにチャンネルへ投稿できる。一方、`content`は
2,000文字、Embedは全Embedの合計で6,000文字までである。現在の契約は該当イベント数に上限を設けず、
「その日の一覧」を1通で全件届けるため、単純に`content`へ入れる実装は契約を満たさない。Webhookは
ファイルを同じメッセージへ添付できるため、容量超過時の完全一覧を添付へ退避すれば、1メッセージと全件を
両立できる。

また、connpassのイベント名やグループ名は外部入力である。Discordはメッセージ送信時にmentionを解釈する
ため、イベント名に`@everyone`等が含まれても通知を発生させない境界が必要である。Discord公式は
`allowed_mentions`で許可対象を明示できるとしている。

一次情報:

- Discord, “Webhook Resource — Execute Webhook”
  <https://docs.discord.com/developers/resources/webhook#execute-webhook>（2026-08-22確認）
- Discord, “Message Resource — Embed Limits”
  <https://docs.discord.com/developers/resources/message#embed-limits>（2026-08-22確認）

## 決定

### 1. 既定NotifierをDiscord Incoming Webhookにする

実行環境は`DISCORD_WEBHOOK_URL`をGitHub Actions secretから受け取る。Discord Bot、Bot token、Gateway、
公開受信エンドポイントは持たない。Webhook URLへ`wait=true`を付けてPOSTし、Discordがメッセージを保存した
結果を返す経路を使う。HTTP 2xxだけを配信成功とし、それ以外と通信例外は`delivered=false`へ変換する。
Webhook URL、Discordの生レスポンス、内部例外を受信者向け要約やログへ出さない。

### 2. 通常はEmbed、6,000文字超過時は完全一覧を同じメッセージへ添付する

整形済み一覧がDiscordのEmbed合計6,000文字以内なら、1つ以上のEmbedへ収めて1メッセージとして送る。
各Embedのdescriptionは4,096文字以内とし、改行境界を優先して分割する。

6,000文字を超える場合はイベントを切り捨てず、次の1メッセージをmultipartで送る。

- `content`: 「一覧が長いため添付ファイルに収めた」と受信者に分かる短い案内
- `files[0]`: 完全な整形済み一覧を含むUTF-8の`connpass-session-radar.txt`
- `payload_json`: 上記contentとmention無効化を表すJSON

添付もDiscord上の同じ1メッセージの一部であり、複数メッセージへ分割しない。イベントの省略、件数上限の
追加、複数通知への変更は行わない。

### 3. mentionを常に無効化する

Embedと添付案内のいずれも`allowed_mentions: { parse: [] }`を送る。イベント名、グループ名、場所その他の
外部入力にDiscordのmention構文が含まれても、ユーザー・ロール・全員へのmentionとして解釈させない。

### 4. 配信先非依存の境界と振る舞いを維持する

`NotifierPort`の入力`DailyDigest`と出力`NotifierResult`、取得、絞り込み、算出、整形は変更しない。
CSR-D-01〜10の「通知先に1通届く」「全イベントが分かる」「0件と分かる」「安全な失敗要約が届く」という
振る舞いをDiscordでも維持する。Discord固有のEmbed・multipart形式はアダプター内だけに閉じる。

### 5. main昇格前に実通信を人間が確認する

テスト用DiscordチャンネルのWebhookを安全なローカル経路で設定し、実connpass APIから取得した一覧を
1通送る。人間がDiscord上の内容を確認するまで実装PRとmain昇格をマージしない。実行時に`ymd`複数値の
結合挙動も観測する。

## ADR-0001・ADR-0002との関係

ADR-0002は既定NotifierをSlackにする単一決定のADRであり、本ADRが全体を置き換える。このため
ADR-0002は`status: superseded`、`superseded_by: 0003`とする。

ADR-0001は複数決定ADRなので全体を`superseded`にはしない。本ADRが現在の既定通知先をDiscordへ更新する
ことを追記し、パイプライン、GitHub Actions、`windowDays`の決定は維持する。

## 検討した代替案

- **Slack Incoming Webhook** / 不採用: 契約承認後、実運用前に人間がDiscordへの変更を指示した。
- **Discord `content`へ全文を送る** / 不採用: 2,000文字上限があり、全イベントを1通で届けられない。
- **複数メッセージに分割** / 不採用: CSR-Dの「1通」を変更する。
- **6,000文字で切り捨てる** / 不採用: その日の一覧からイベントを黙って落とす。
- **Embed＋同一メッセージへの添付フォールバック** / 採用: 通常時の読みやすさと、容量超過時の1通・全件を
  両立できる。

## 帰結

- Slack Webhook URLとSlack実装は不要になる。Draft PRのSlack実装はマージしない。
- `DISCORD_WEBHOOK_URL`はconnpass APIキーと同じくGitへ置かず、ログにも出さない。
- DiscordアダプターのL3テストは、Embed経路、添付経路、全件保持、mention無効化、`wait=true`、安全な
  失敗要約を検証する。
- ADR・契約承認後にDiscordアダプターを実装し、L0〜L4と実送信レビューを行う。

