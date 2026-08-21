# Connpass Session Radar — design map

> 承認済みADR-0001の骨格を映す現在の地図。commit・review済みの実装詳細、言語、ファイル構成は
> 未確定である。別worktreeの未commitなdeveloper draftは、この地図の根拠にしない。

| 部分 | 責務 | 主な依存方向 |
|---|---|---|
| 実行起点 | 毎朝の一回の処理を開始し、配信失敗を実行失敗として扱う | パイプラインへ |
| 条件読込 | commit済みYAMLからその実行時点の興味条件を読む | パイプラインへ |
| 取得 | connpass API v2から候補イベントを得る | connpass APIのみ |
| 絞り込み・算出 | 条件、期間、中止、残席、満席を解釈する | 取得結果 → 整形 |
| 整形 | `DailyDigest`を生成する | 通知境界へ |
| 通知 | `DailyDigest`をLINE Messaging APIへ届ける | 通知先外部APIのみ |

依存は左から右へ流す。外部APIに触れるのは取得と通知だけであり、条件評価・変換・整形はその間に閉じる。
永続化層、画面層、公開サーバ層は存在しない。
