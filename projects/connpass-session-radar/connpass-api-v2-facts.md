# connpass API v2 — 一次情報（2026-08-16 取得）

出典: `https://connpass.com/about/api/v2/openapi.json`（Redoclyページの元定義を直接取得）と
`https://help.connpass.com/api/`。**推測は含まない**。実測できなかった項目は「未確認」と明記する。

**2026-08-23 更新**: APIキーが発行され実運用に入ったため、**実測で確定した3点**を本文へ取り込んだ
（`ymd`複数値のOR結合／レスポンスに`prefecture`が無いこと／`users/{nickname}/attended_events/`の
パラメータと戻り値）。あわせて「未確認」に2点を追加した——`keyword`と`keyword_or`を同時に渡した
ときの結合、および`prefecture`複数値の結合。**実測した事実の出どころは実運用のログであり、
文書側の記述ではない**ことを各所に明記してある。

## 認証・制限

| 項目 | 値 |
|---|---|
| ベースURL | `https://connpass.com/api/v2/` |
| 認証 | リクエストヘッダ `X-API-Key`。全エンドポイントで必須 |
| 認証失敗 | `401 Unauthorized` |
| スロットリング | **APIキーごとに1秒間に1リクエストまで**（原文「現状」）。超過で `429 Too Many Requests` |
| キー発行 | 個人・コミュニティは申請制・無料、**1キーのみ**（追加不可）。企業・法人は有料（月額297,000円〜）で個人向け申請は不可 |
| v1 | 2025年末に廃止予定。**v2のみを前提にする** |

利用規約上の制約: API以外の手段による当サービスへのクローリング・スクレイピングは、自動化の有無に
かかわらず禁止（`https://connpass.com/term/`）。→ **APIで取れないものはHTMLから取らない**。

## エンドポイント一覧

- `GET /api/v2/events/` — イベント検索
- `GET /api/v2/events/{id}/presentations/` — イベント資料
- `GET /api/v2/groups/` — グループ検索
- `GET /api/v2/users/` — ユーザー検索
- `GET /api/v2/users/{nickname}/groups/` — 所属グループ
- `GET /api/v2/users/{nickname}/attended_events/` — 参加イベント
- `GET /api/v2/users/{nickname}/presenter_events/` — 発表イベント

**申込・キャンセルのAPIは存在しない**（読み取り専用）。**参加者一覧を取るAPIも無い**。

### `GET /users/{nickname}/attended_events/` と `.../presenter_events/`（2026-08-23 取得）

**自分の参加履歴・発表履歴が取れる。** 両者はパラメータも戻り値の形も同一である。

- リクエストパラメータは **`start` と `count` の2つだけ**（`count` は最大100、既定10）。
  **日付で絞れない**——期間を限りたければ全件取ってクライアント側で絞る
- レスポンスの封筒は `GET /events/` と同じ（`results_returned` / `results_available` /
  `results_start` / `events[]`）
- `events[]` の要素は **`GET /events/` とまったく同じ `EventSchema`**。したがって
  `title` / `catch` / `description` / `hash_tag` / `group`（id・title・url）/ `started_at` /
  `place` / `address` / `lat` / `lon` / `accepted` などが全部そろう

**未確認**: 「attended」が*参加登録した*を指すのか*受付された*を指すのかを定義した記述が無い。
キャンセルした申し込みがどう扱われるかも同様である。**履歴を分析や可視化の根拠にするなら、
まずここを実測で確かめること**——この一点で結果の意味が変わる。

## `GET /events/` リクエストパラメータ（正確な名前）

複数指定は `name=v1&name=v2` または `name=v1,v2` の両方が可。

| パラメータ | 型 | 意味 |
|---|---|---|
| `event_id` | int[] | イベントID |
| `keyword` | string[] | **AND** 条件の部分一致。対象は**タイトル・キャッチ・概要・住所** |
| `keyword_or` | string[] | **OR** 条件の部分一致。対象は同上 |
| `ym` | string[] | 開催年月 `yyyymm` |
| `ymd` | string[] | 開催年月日 `yyyymmdd` |
| `publish_ym` | string[] | 公開年月 `yyyymm` |
| `publish_ymd` | string[] | 公開年月日 `yyyymmdd` |
| `nickname` | string[] | 参加者のニックネーム |
| `owner_nickname` | string[] | 管理者のニックネーム |
| `group_id` | int[] | グループID（v1の `series_id`） |
| `subdomain` | string[] | グループのサブドメイン |
| `prefecture` | string[] | `online` ＋ 47都道府県のローマ字（`toyama`・`tokyo` 等） |
| `order` | int | `1`=更新日時順（既定） / `2`=開催日時順 / `3`=新着順 |
| `start` | int | 開始位置。1以上、既定1 |
| `count` | int | 取得件数。**1〜100**、既定10 |

## `GET /events/` レスポンス

トップレベル: `results_returned` / `results_available` / `results_start` / `events[]`（全てrequired）

`events[]` の要素（`EventSchema`。以下は全てrequired）:

`id`(int) / `title`(str) / `catch` / `description` / `url`(str, connpass.com上のURL) /
`image_url` / `hash_tag` / `started_at`(ISO-8601, null可 例`2012-04-17T18:30:00+09:00`) /
`ended_at` / `published_at` / `limit`(int, **null可**=定員) / `event_type`(str) /
`open_status`(str) / `group`(オブジェクト, null可) / `address` / `place` / `lat` / `lon` /
`owner_id` / `owner_nickname`(str) / `owner_display_name`(str) / `accepted`(int, 参加者数) /
`waiting`(int, 補欠者数) / `updated_at`(str, ISO-8601)

**`prefecture` はリクエストのパラメータにしか存在せず、レスポンスのイベントには含まれない**
（2026-08-22に実測で確認）。したがって「このイベントはオンライン開催か」をレスポンス単体からは
判定できない——`prefecture=online` で絞って取得したという**リクエスト側の文脈**でしか分からない。

列挙値:
- `event_type`: `participation`（connpassで参加受付あり） / `advertisement`（告知のみ）
- `open_status`: `preopen`（開催前） / `open`（開催中） / `close`（終了） / `cancelled`（**中止**）

`group`（`GroupSummarySchema`）: `id`(int) / `subdomain` / `title`(str) / `url`(str)

## 仕様に効く制約（ここが設計判断を縛る）

1. **開催日の「範囲」指定ができない。** あるのは `ym`（年月）と `ymd`（年月日）のピンポイント指定
   だけで、「今日以降」「7日以内」に相当するパラメータが無い。**「直近N日」を取るには ymd を N個
   並べる**か、`ym` で月を取ってクライアント側で日付を絞る。月またぎでは `ym` を2個必要とする。
   **`ymd` は配列パラメータであり、複数値は1リクエストに渡せる**（冒頭の共通規則「複数指定は
   `name=v1&name=v2` または `name=v1,v2`」が `ymd` を除外していない）。したがって**日数がそのまま
   リクエスト回数になるわけではない**。複数値の結合がOR（いずれかの日に開催）であることを明記した
   一文は**文書には無い**が、**2026-08-22に実測して確認した**——`ymd=20260822` が114件、
   `ymd=20260828` が60件、両方を渡すと174件（＝和集合。重複0件）だった。反復指定（`ymd=a&ymd=b`）と
   カンマ指定（`ymd=a,b`）で結果は同じである。
2. **除外語（NOT）が無い。** `keyword` はAND、`keyword_or` はOR、いずれも部分一致のみ。
   **除外はクライアント側で実装するしかない**（YAMLに除外語を持つなら自前フィルタになる）。
3. **キーワードの検索対象は「タイトル・キャッチ・概要・住所」**。住所が含まれるため、地名を
   キーワードに入れると意図しない一致が起きうる。地域で絞るなら `prefecture` を使う。
4. **残席のフィールドが無い。** `limit - accepted` で計算する。`limit` は null（定員なし）を取りうる
   ので、その分岐が要る。満席かどうかは `waiting`（補欠者数）とあわせて判断する。
5. **1リクエスト最大100件**。`results_available` で総件数が分かるので、ページングの要否は判定できる。
   ただし **1秒1リクエスト**の制限があるため、ページング数がそのまま所要時間になる。
6. **中止イベントが混ざる。** `open_status = cancelled` を落とさないとダイジェストに中止済みが載る。
7. **`advertisement`（告知のみ）が混ざる。** connpassで参加受付しないイベントなので、
   「申し込める勉強会」を出したいなら `event_type` で絞る判断が要る。
8. **APIキーは1本**。並列取得で回避できない（キー単位の制限）。

## 未確認

- スロットリングの「1秒1リクエスト」以外の上限（1日あたりの総リクエスト数など）の有無
- APIキー申請の審査期間
- **レスポンスのキャッシュ可否・再配布可否についての明文**（利用規約本文は未読）。取得したデータを
  公開の場（GitHub Pages・プロフィールリポジトリ等）へ載せることを考えるなら、**これを読むのが先**である
- **`keyword`（AND）と `keyword_or`（OR）を同一リクエストへ同時に渡したときの結合**。それぞれ単独の
  意味は明記されているが、両方を渡した場合にAND結合されるのかどうかは書かれていない。「AWSかつ
  入門向け」のように話題と深さを掛け合わせて絞るには、この結合の実測が要る
- **`prefecture` の複数値の結合**（OR結合と推測しているが明文は無い）
