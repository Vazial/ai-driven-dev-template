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

CSR-D-01〜10実装とL4 translationは完了している。Discord置換後のorchestrator確認はL0 green、
通常・UTC環境のNode tests 19/19、syntax green、L4 CSR-D-01〜10 greenである。既存のreviewer監査対象だった
steps/DSLと受け入れbridgeは変更していない。
すべてのCSR-Dシナリオから`@pending-implementation`を外している。

## 保留・外部事実

- APIキーはローカル専用設定から値を表示せずに使用し、2026-08-22に実connpass API v2への取得を確認した。
  値はGit・ログ・成果物へ保存していない。
- `ymd`の複数値はOR結合であることを実測した。2026-08-22の114件と2026-08-28の60件は重複0件で、
  反復指定とカンマ指定はいずれも和集合と同じ174件だった。現在の反復指定実装を維持する。
- commit済み条件（AWS・オンライン・7日間）で実データ11件を取得し、1,672文字のEmbed用一覧を生成した。
  API v2はイベントへ`prefecture`を返さないためオンライン表示を誤る事実を実測で発見し、オンライン限定
  profileから取得したイベントをオンラインとして正規化する修正と回帰テストを追加した。全11件がオンライン
  表示になり、重複した「オンライン / オンライン」は0件である。
- プロジェクト専用CIはL1→L4を直列実行する。scheduled workflowは毎日08:00
  `Asia/Tokyo`に設定し、手動実行も許す。scheduleはGitHubの仕様上、mainへの昇格後に既定ブランチの
  最新版として動く。GitHub Secretsへの`CONNPASS_API_KEY`・`DISCORD_WEBHOOK_URL`登録状態は未確認であり、
  実プロバイダへの接続もまだ行っていない。
- 次は上記の実一覧をテスト用Discordチャンネルへ1通送信して人間が受信内容を確認する。Discord実送信は
  まだ行っていない。確認が終わるまで実装PRもmain昇格もマージしない。
