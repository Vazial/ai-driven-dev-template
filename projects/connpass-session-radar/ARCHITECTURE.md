# Connpass Session Radar — architecture

> 承認済みのADR-0001とADR-0003を投影した、設計の現在の地図。ここに新しい決定はない。

## 全体

GitHub Actionsのスケジュール実行が、状態を持たない一回限りのパイプラインを起動する。

```text
興味条件 YAML → 取得 → 絞り込み・算出 → 整形 → 通知
                   ↑                              ↓
             connpass API                    Discord Incoming Webhook
```

通知済みイベント、既読状態、永続ストア、画面、および公開HTTP面は持たない。

## 境界と責務

- 興味条件: リポジトリ内のYAMLを実行ごとに読み直す。`windowDays`は条件の一部である。
- 取得: connpass API v2からイベントを取得する外部I/O境界。
- 絞り込み・算出: 条件適合、中止除外、対象期間、残席・満席の意味を処理する。
- 整形: `DailyDigest`を作る。該当なし・処理失敗も通知対象にする。
- 通知: `NotifierPort`の背後で、既定のDiscord Incoming Webhookへ配信する。通常はEmbedを使い、6,000文字を
  超える完全一覧は同じメッセージのUTF-8添付にする。mentionは無効化する。将来の配信先はこの境界で置換できる。

受け入れテストは、承認済みのtest-support契約が定める合成イベント取得と通知捕捉だけを使う。本番の
スケジュール実行は差し替えを使わず、実connpass APIと実通知先を使う。

## 用語

- `InterestConditions`: commitされたYAML上の興味条件全体。
- `NormalizedEvent`: connpassの生データから独立した、絞り込み・算出後のイベント。
- `DailyDigest`: 1回の配信へ渡す一覧または状態通知。
- `NotifierPort`: `DailyDigest`を配信先に届ける差し替え可能な境界。
