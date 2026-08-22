# activeContext.md — Connpass Session Radar

> P-11: このファイルは常に現在だけを映す。履歴はgitとADRが持つ。

## 現在

connpassの条件に合うイベントを毎朝1通届ける、画面・永続状態を持たないパイプラインである。興味条件は
リポジトリ内のYAML、通知先はDiscord Incoming Webhook、起点はGitHub Actionsのスケジュール実行、対象期間は
`windowDays`である（ADR-0001）。外部I/Oはconnpass API v2の取得と通知だけで、NotifierPortは将来の
通知先の差し替えを許す。

`daily-digest-test-support.yaml` v0.3は承認済みである。ADR-0003によりADR-0002のSlack案を実運用前に
取り止め、既定NotifierをDiscord Incoming Webhookへ置き換えた。実装も通常はEmbed、6,000文字超過時は
完全一覧を同じメッセージへ添付し、mentionを無効化して`wait=true`で送るDiscordアダプターへ置換した。
NotifierPortとCSR-D-01〜10の振る舞いは変わらない。

CSR-D-01〜10実装とL4 translationは完了している。すべてのCSR-Dシナリオから`@pending-implementation`を
外している。既存のreviewer監査対象だったsteps/DSLと受け入れbridgeは変更していない。

2026-08-22のreviewで見つかった3つの穴を実装側で塞いだ（契約・シナリオは変更していない）。

- 興味条件YAMLの未知フィールドと型違いを例外にする。`keywordAny:`のような誤記は従来そのまま素通りし、
  絞り込み条件ゼロのリクエスト＝connpass全件配信に化けていた。契約の`additionalProperties: false`へ
  実装を寄せた
- `CONNPASS_API_KEY`欠落と条件ファイルの読めない朝も、失敗通知を1通配信する。従来はパイプラインに
  入る前にthrowして無通知だった（product-brief §6・CSR-D-04）
- 失敗の理由を注入されたsinkへ報告し、スケジュール実行ではworkflowログへ出す。受信者向けの要約は
  従来どおり内部事情を含まない。受け入れ実行では沈黙する（canaryをログへ出さない）

検証は自分で実行した: L0 green、Node tests 28/28、syntax green、L4 CSR-D-01〜10 green。

## 保留・外部事実

- APIキーはローカル専用設定から値を表示せずに使用し、2026-08-22に実connpass API v2への取得を確認した。
  値はGit・ログ・成果物へ保存していない。
- **未着手の宿題（2026-08-22のreview）**: (1) 実測したAPI事実（`ymd`のOR結合、v2がイベントに
  `prefecture`を返さないこと）が`connpass-api-v2-facts.md`へ昇格しておらず、上書き運用の本ファイルに
  しかない。(2) ルート`activeContext.md`のプロジェクト行が「実装は一行も無い／通知先未定」のままで、
  昇格PRで直す必要がある。(3) 定員なし＋補欠ありを満席と示すか（CSR-D-09の文言との差）と、
  `prefectures`が`['online']`単独のときだけオンライン表示になる限界は、人間の判断で見送った。
- `ymd`の複数値はOR結合であることを実測した。2026-08-22の114件と2026-08-28の60件は重複0件で、
  反復指定とカンマ指定はいずれも和集合と同じ174件だった。現在の反復指定実装を維持する。
- commit済み条件（AWS・オンライン・7日間）で実データ11件を取得し、1,672文字のEmbed用一覧を生成した。
  API v2はイベントへ`prefecture`を返さないためオンライン表示を誤る事実を実測で発見し、オンライン限定
  profileから取得したイベントをオンラインとして正規化する修正と回帰テストを追加した。全11件がオンライン
  表示になり、重複した「オンライン / オンライン」は0件である。
- 通常テキストチャンネルのDiscord Incoming Webhookへ同じ実データ11件を1通のEmbedとして配信し、
  2026-08-22に人間が受信内容を「とりあえずOK」と確認した。mentionは発生していない。フォーラムチャンネルの
  Webhookは`thread_name`または`thread_id`が必須で現在の契約対象外であるため、通常テキストチャンネルを使う。
- プロジェクト専用CIはL1→L4を直列実行する。scheduled workflowは毎日08:00
  `Asia/Tokyo`に設定し、手動実行も許す。scheduleはGitHubの仕様上、mainへの昇格後に既定ブランチの
  最新版として動く。ローカル経路で両実プロバイダへの接続は確認済みだが、GitHub Secretsへの
  `CONNPASS_API_KEY`・`DISCORD_WEBHOOK_URL`登録状態は未確認である。
- 実通信を含む人間確認まで完了した。PR #120は`project/connpass-session-radar`へマージ済みである。
  次はreviewスライスを同ブランチへ戻し、そのうえでmainへの昇格PRを出す。
