---
id: 0007
scope: project/reservation-system
status: 提案中
date: 2026-07-22
approved_by: null
supersedes: []
superseded_by: null
relates_to: []
---
# ADR-0007: GET /roomsを新設し、会議室一覧(概要)と GET /rooms/{roomId}/rules(予約前詳細)の役割を分担する

> **承認者向けサマリ**: 会議室予約フロントエンド(reservation-frontend)のタイムライン画面が会議室一覧を
> 必要としており、契約に無いことが分かっていた(design/reconciliation/booking-design-reconciliation.md
> 項目1)。人間は「reservation-systemにGET /roomsを追加する・フロントの必要から形を決める
> (consumer-driven contract)」と決定済み。本ADRは、その形を具体的にどう設計したか(何を返すか・
> 既存のGET /rooms/{roomId}/rulesとどう役割分担するか・表示名フィールドの扱い)を裁定する、
> **未承認のドラフト**。契約本体(reservation-api.yamlのAPI形状追記)のドラフトと合わせて人間のレビュー・
> 承認を待つ(P-06)。**受け入れシナリオ(一覧内容・name昇順・0件=空一覧)は本ADR・本契約改訂の対象外**とし、
> 実装スライスでtesterがRSV-Lとして起こす(IDは予約)。理由: シナリオIDが契約検証(govlint)と実装検証
> (Cucumber)を結合しており、実装を伴わないシナリオの下書きを契約に置けない構造上の制約による
> (詳細はfriction-log.mdの当該記録を参照)。

## 文脈

reservation-frontend側の設計成果物(`BookingDesign.tsx`)と契約の突き合わせ(reconciliation、項目1・7・
19)で、会議室一覧を取得する契約が存在しないことが判明していた。フロントのタイムライン画面は、会議室
ごとの識別子(id)・表示名(name)・定員(capacity)・営業時間を必要とする。人間は「GET /roomsを
reservation-systemに追加する」「フロントの必要から形を決める(consumer-driven contract)」ことを決定
した(2026-07-22)。

既存の`GET /rooms/{roomId}/rules`(RSV-R、承認済み2026-07-17)は、会議室1件について営業時間・定員・
最小予約時間(システム共通)を返す単体クエリであり、会議室IDを既知とすることが前提のため、一覧・存在
確認の手段にはならない(reconciliation項目1で既に指摘済み)。新設する一覧APIと`/rules`はフィールドが
一部重複する(営業時間・定員)ため、役割分担を明確にしておく必要がある。

また、フロントが必要とする表示名(name)は、現行の公開APIのどのレスポンスにも含まれていない。ただし
design.mdの`rooms`テーブル定義、および`test-support-api.yaml`の`RoomUpsertRequest`/`RoomResponse`には
2026-07-13(RSV-Cスライス開始時点)から既に`name`列・フィールドが存在する。したがって本ADRが扱うのは
新しいデータモデル決定(列の新設)ではなく、既存フィールドを初めて公開APIのレスポンスに露出するという
判断である。

## 決定

1. `GET /rooms`を新設する。パスパラメータ・クエリパラメータを持たず、認証を要求しない、常に200を
   返す一覧クエリとする(閲覧は公開情報、というADR-0003の精神を踏襲)。
2. レスポンスの各要素(`RoomSummary`)には `roomId`・`name`・`businessHoursStart`・
   `businessHoursEnd`・`capacity` を含める。**`minReservationDurationMinutes`(最小予約時間)は含め
   ない**。理由: この値はシステム共通の単一の値であり(RSV-R解釈ポイント(3)で既にロック済み)、一覧の
   要素ごとに複製しても同じ値をN回繰り返すだけで一覧としての価値を持たない。値の出処を1箇所
   (`/rules`)に保つことで、将来の実装で一覧側と`/rules`側の値がズレる二重管理のリスクを避ける。
   ADR-0006が確立した「最小予約時間ルールをドメイン1箇所に保つ」方針をAPI表層でも継続する。
3. `GET /rooms/{roomId}/rules`(RSV-R)は変更しない。役割は「個別の会議室について、予約を試みる直前
   に必要な詳細(営業時間・定員・最小予約時間)を確認する」に据え置く。`name`を`/rules`に追加する案は
   今回採らない(検討した代替案を参照)。
4. `GET /rooms`の並び順は**表示名(`name`)の昇順**とする。`roomId`はサーバ採番の不透明な識別子であり
   (`test-support-api.yaml`の`RoomResponse`例「`roomId: 5f3a…(サーバ採番)`」)、業務上の並び順の基準
   にならない。人間が読む一覧として意味を持つ唯一の基準は表示名である。
5. 会議室が0件のときは200+空配列(`rooms: []`)を返す。404にはしない。一覧クエリ自体は成功しており、
   対象が0件であることは、個々の会議室の不存在(`ROOM_NOT_FOUND`、RSV-A-07/RSV-R-03)とは異なる意味論
   である。
6. レスポンスは配列を直接返さず、`rooms`キーを持つオブジェクト(`RoomListResponse`)でラップする。
   既存の全レスポンス(`ReservationResponse`・`AvailabilityResponse`等)がオブジェクトであるパターン
   との整合、および将来のページング・件数等のメタデータ追加への拡張余地を残すため
   (現時点ではページング・絞り込みクエリパラメータを持たない。P-02: 今必要な分だけ)。
7. **受け入れシナリオ(一覧内容・name昇順・0件=空一覧)は、本ADR・本契約改訂では起こさない**。決定1〜6
   が確定する「何を返すか」と、それを検証するシナリオを書く作業を、位相として分離する(validation/
   decision ↔ scenario/implementation)。実装スライス着手時に、testerがこの契約(決定1〜6)から
   受け入れシナリオをRSV-Lとして起こし、developerが実装して緑にする。ID(RSV-L-01等)は現時点では
   予約のみで、契約ファイルには書かない。

## 検討した代替案

- 案A: `GET /rooms/{roomId}/rules`に`name`フィールドを追加し、`GET /rooms`は最小限(`roomId`+
  `name`)のみ返す構成にする / 不採用の理由: フロントは一覧表示の時点で営業時間・定員も必要とする
  (タイムライン描画・定員チェックの土台)。一覧取得後に会議室数だけ`/rules`を追加で呼ぶ設計は、
  「一覧を見る」という業務の目的に対して回りくどい(RSV-Rの解釈ポイント(2)が採った「回りくどさを
  避ける」判断と同じ理由)。
- 案B: `GET /rooms`に`minReservationDurationMinutes`も含め、一覧だけで予約前情報が完結するように
  する / 不採用の理由: 決定2で述べた値の複製・二重管理リスク。一覧は「会議室を選ぶための概要」、
  `/rules`は「選んだ後の詳細確認」という利用順序(タイムライン表示 → 予約ダイアログでの検証)に、
  役割分担の方が自然に対応する。
- 案C(採用): `GET /rooms`を新設し、一覧は概要(`name`を含む)、`/rules`は詳細(最小予約時間を維持)に
  役割分担する。`name`は`/rooms`のみに追加し、`/rules`は変更しない。

## 帰結

- `reservation-api.yaml`に`GET /rooms`(RSV-L追記ブロック)を追加した(ドラフト、API形状のみ。契約
  自体は別途人間承認待ち)。`RoomSummary`・`RoomListResponse`スキーマを新設した
- `GET /rooms/{roomId}/rules`(RSV-R)・そのレスポンススキーマ(`RoomRulesResponse`)・
  `contracts/reservation-rules.feature`は無変更
- **受け入れシナリオ層(`contracts/reservation-rooms.feature`、RSV-L)は今回起こさず、実装スライスに
  持ち越す**。理由: シナリオIDがgovlint(契約側の参照整合)とCucumber(実装側の未定義ステップ検出)の
  両方を結合しており、「実装より先にシナリオだけを下書きする」状態を構造的に作れないため(発見の経緯は
  friction-log.mdに記録)。契約(API形状)とADR裁定はここで確定し、シナリオの起票と実装はセットで次の
  スライスに委ねる。同様に`test-support-api.yaml`の`DELETE /test-support/rooms`(RSV-L-03の前提用に
  一時追加したもの)も、消費者となるシナリオが存在しなくなったため削除した(実装スライスで必要に
  なれば再導入する)
- design.mdの`rooms`テーブル定義自体の変更は不要(`name`列は既存)。ただし「公開APIが`name`を返す
  ようになる」という設計骨格上の変化は、本契約の承認と同時にdesign.mdへ反映する(architectの通常の
  維持責務。今回の契約・本ADRがまだドラフトのため、design.md本体の更新は契約承認に随伴させ、現時点
  では行わない)
- 将来、`/rules`にも`name`を含めたくなった場合(例: 予約フォーム単体表示でAPIコールを1回に減らし
  たい等)は、別途スライスとして再検討する。本ADRは今回の判断としてこれを不採用にしただけで、将来の
  追加を禁じるものではない
