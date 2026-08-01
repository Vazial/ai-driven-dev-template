---
id: 0008
scope: project/reservation-system
status: 承認済み
date: 2026-08-01
approved_by: "本PRのマージをもって承認（ADR-0035 方式(i)。契約 reservation-room-registration.feature と同時に承認される＝断面①。承認しない場合はマージしないこと）"
supersedes: []
superseded_by: null
relates_to: []
---
# ADR-0008: 会議室を登録するAPI(POST /rooms)を新設し、識別子の採番・表示名の一意性・営業時間の妥当性を裁定する

> **承認者向けサマリ**: ローカルで予約システムとして一通り動くかを確かめようとしたところ、**通常起動
> (Springプロファイル未指定)では会議室を1件も作れない**ことが判明した。会議室登録の唯一の経路である
> `POST /test-support/rooms`は`@Profile("acceptance")`限定で本番構成には存在せず、Flywayのマイグレーション
> (`V1__create_reservation_tables.sql`)は`rooms`テーブルの作成のみでINSERTを持たず、`data.sql`・
> `CommandLineRunner`等のseed経路も存在しない。人間は「会議室を登録する正式なAPIを足す」ことを決定した
> (2026-08-01。他の選択肢=dev用seedデータ投入・DB直接投入は不採用)。本ADRは、その正式APIを具体的にどう
> 設計したか(識別子は誰が決めるか・何を拒否すべきか・既存のtest-support seamとどう役割分担するか)を
> 裁定する、**未承認のドラフト**。契約本体(`reservation-api.yaml`のRSV-T追記、
> `contracts/reservation-room-registration.feature`)のドラフトと合わせて人間のレビュー・承認を待つ(P-06)。

## 文脈

`GET /rooms`(RSV-L)・`GET /rooms/{roomId}/rules`(RSV-R)・`GET /rooms/{roomId}/availability`(RSV-A)・
`POST /reservations`(RSV-C)はいずれも「会議室が既に存在する」ことを前提にしている。この前提を満たす
公開APIがこれまで一つも存在しなかった。唯一の会議室登録手段だった`POST /test-support/rooms`は受け入れ
テスト用のGiven seam(`meta/adr/0008`、テストインフラ契約であり業務契約ではない)であり、
`@Profile("acceptance")`でのみ有効という設計上の制約により、通常起動では会議室を作る手段が構造的に
存在しない。

このスライスのスコープは人間が決定済み: **APIのみ**(管理画面は作らない)。ローカルからcurl等で1回
叩ければ足りる水準。**更新・削除は範囲外**(`PUT`/`DELETE /rooms/{id}`は今回作らない。必要になってから
足す、P-02/P-05)。

## 決定

1. `POST /rooms`を新設する。**`roomId`はサーバ採番とし、リクエストボディに含めない**(クライアント
   指定不可)。理由: 既存の`POST /reservations`が`reservationId`をサーバ採番する形と同型であり、
   `POST /test-support/rooms`が既に「応答は`roomId`フィールドで部屋IDを返す」「サーバ採番」という
   語彙・実績を持っている(design.md「受け入れテスト用seam」節、`test-support-api.yaml`の
   `RoomResponse`例「`roomId: 5f3a…(サーバ採番)`」)。この既存の実績と揃えることで、公開APIと
   テストseamの間で識別子の意味論が一致する。
2. 成功時の応答は新しいスキーマを作らず、既存の`RoomSummary`(RSV-L追記、`roomId`・`name`・
   `businessHoursStart`・`businessHoursEnd`・`capacity`)をそのまま再利用する。`GET /rooms`の一覧要素と、
   単体登録の結果は同じ形で過不足がなく、二重管理のリスクを避けられる(ADR-0006・0007が確立した
   「値の出処を1箇所に保つ」方針をスキーマ表層でも継続する)。
3. **表示名(`name`)の重複は拒否する**(409、`ROOM_NAME_DUPLICATE`)。理由: `GET /rooms`(RSV-L、
   adr/0007決定4)は`name`(表示名)の昇順を一覧の唯一の並び順基準にしており、`roomId`(サーバ採番の
   不透明な識別子)を意識しない利用者は名前で会議室を区別・選択する。重複した表示名を許すと、利用者が
   会議室を取り違える事故を招く。この契約は、名前の一意性を実施する**初めての書き込み経路**である
   (`POST /test-support/rooms`は意図的に「同名は上書き」という別の振る舞いを持つが、これはテストの
   Given準備を冪等にするための擬似的な挙動であり、業務上の一意性判断ではない。決定8を参照)。
   既存の`TIME_SLOT_CONFLICT`(RSV-C、時間帯の重なり)と同種の「既存の状態と衝突する」意味論のため、
   拒否コードは409系として新設する。
4. **営業時間の妥当性(終了時刻は開始時刻より後でなければならない)を拒否する**(422、
   `INVALID_BUSINESS_HOURS`)。理由: 会議室自身の営業時間が`end <= start`という構造的に壊れた状態だと、
   その会議室に対するあらゆる予約(RSV-C)・空き枠確認(RSV-A)・予約ルール確認(RSV-R)が意味を持たなく
   なる。RSV-C-06/07(予約単体の時間帯の逆転・同一時刻を`INVALID_TIME_SLOT`で拒否)と同型の判断を、
   会議室自身の営業時間という別の対象に適用したものである。ただし対象(予約の時間帯 vs 会議室の営業
   時間の定義)が異なるため、既存の`INVALID_TIME_SLOT`は再利用せず、新しいコードを設ける(検討した
   代替案Aを参照)。
5. **定員の下限(1人以上)は、拒否理由コード付きの業務ルールとしては表現しない**。JSON Schemaの制約
   (`minimum: 1`)のみで表現する。理由: 既存契約に前例がある——`CreateReservationRequest.attendeeCount`
   も同じ`minimum: 1`を持つが、対応する拒否シナリオ(0人などの入力)は`reservation-create.feature`に
   存在しない。数値の下限はスキーマ層の妥当性であり、拒否理由コード付きの業務ルール(409/422)として
   扱う対象ではないという既存の切り分けを継続する。
6. **営業時間の幅が最小予約時間(30分)未満になる登録(例: 09:00-09:15)は拒否しない**。理由: そのような
   会議室が実在しても、空き枠確認(RSV-A-04と同型の「全て埋まっている」の意味論)が「予約可能な空き
   なし」を返すだけであり、会議室自身の設定として構造的に破綻しているわけではない。使い勝手が悪い
   だけの状態を登録時点で拒否する理由は今のところない(P-02。この制約は今のところどのシナリオの発端
   にもなっていない。検討した代替案Dを参照)。
7. **登録者の識別(`reserverId`に相当する登録者ID)は要求しない**。理由: (a) 会議室を管理する主体の
   識別・権限モデルはワーク(`docs/workshop-summary-01-reservation.md`)にも既存の契約群にも存在しない、
   (b) 更新・削除(所有者チェックが必要になりうる操作)は本スライスの範囲外であり、登録者IDを持たせても
   今は使い道がない(P-02)、(c) `POST /test-support/rooms`の`RoomUpsertRequest`も登録者IDを持たない。
8. `POST /test-support/rooms`(Given seam)は**維持する**。役割は分岐する: 本番API(`POST /rooms`)は
   業務ルール(表示名の重複拒否・営業時間の妥当性検証)を適用する一方、test-supportは既存5スライス
   (RSV-C/K/A/R/L)のBackgroundが依存する「同名なら設定を上書きする」という冪等setup専用の挙動を
   保つ。両者を統合する(test-supportを本番APIの薄いラッパーにする)と、既存の全Backgroundの
   「Given 会議室"会議室A"が存在する」がシナリオ実行順に依存して壊れる(2回目以降の実行で重複エラーに
   なる)ため、統合は採らない(検討した代替案Cを参照)。

## 検討した代替案

- 案A: 営業時間の妥当性違反も既存の`TIME_SLOT_CONFLICT`/`INVALID_TIME_SLOT`を再利用する / 不採用:
  予約の時間帯と会議室の営業時間は別のドメイン概念であり、同じコードを共有すると`ProblemResponse.code`
  の説明文が「どちらの文脈の話か」を読み手に推論させることになる。新設コストは低く、コードの意味を
  対象ごとに保つ方が誤解を招かない。
- 案B: 表示名の重複を許可し、`roomId`で一意性を保証すれば十分とする / 不採用: 決定3を参照。名前が
  利用者の選択基準である以上、重複は運用上の事故(取り違え)を招く。
- 案C: `POST /test-support/rooms`を廃止し、本番`POST /rooms`に一本化する / 不採用: 決定8を参照。
  冪等setupという既存5スライスの利用パターンを壊す。
- 案D: 営業時間の幅が最小予約時間未満になる登録を拒否する / 不採用: 決定6を参照。構造的破綻ではなく
  既存の「空き枠0件」の意味論で吸収できるため、P-02によりこの契約では扱わない。

## 帰結

- `reservation-api.yaml`に`POST /rooms`(RSV-T追記)を追加した(ドラフト)。`RoomRegistrationRequest`
  スキーマを新設し、応答は既存の`RoomSummary`を再利用する。`ProblemResponse.code`に
  `ROOM_NAME_DUPLICATE`・`INVALID_BUSINESS_HOURS`を追記した。
- `contracts/reservation-room-registration.feature`(RSV-T-01〜04)を新設した(ドラフト)。
- `test-support-api.yaml`・`POST /test-support/rooms`は無変更。
- `design.md`の`rooms`テーブル定義自体の変更は不要(列は既存)。「公開APIから会議室を書き込めるように
  なる」という設計骨格上の変化は、本契約の承認と同時に`design.md`へ反映する(architectの通常の維持
  責務。今回の契約・本ADRがまだドラフトのため、`design.md`本体の更新は契約承認に随伴させ、現時点では
  行わない。ADR-0007の帰結と同じ扱い)。
- 本ADRおよび付随する契約ドラフトは、いずれも人間の承認を待つ(P-06/P-07)。承認後、`RSV-T`の
  シナリオ実装・本体実装は次の実装スライスで行う。
