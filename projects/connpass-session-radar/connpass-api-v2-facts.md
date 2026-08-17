# connpass API v2 — 一次情報（2026-08-16 取得）

出典: `https://connpass.com/about/api/v2/openapi.json`（Redoclyページの元定義を直接取得）と
`https://help.connpass.com/api/`。**推測は含まない**。実測できなかった項目は「未確認」と明記する。

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
   リクエスト回数になるわけではない**。ただし**複数値の結合がOR（いずれかの日に開催）であることを
   明記した一文は無い**——ADR-0001起草時に発見した空白であり、APIキー発行後の実測で埋める。
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
- レスポンスのキャッシュ可否・再配布可否についての明文（利用規約本文は未読）
