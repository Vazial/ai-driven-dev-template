# Reconciliation — RSV-L(GET /rooms) SSoT突き合わせ(yaml ↔ フロントの型・実装)

> **承認者向けサマリ**: `GET /rooms`（RSV-L）は現在、`projects/reservation-system/contracts/
> reservation-api.yaml`にAPI形状がドラフトされ（`reservation-system/adr/0007`が裁定）、断面①
> （骨格合意）の人間承認を待っている状態にある。本ファイルは、そのSSoT（yaml）と、フロント側の
> 手書きの写し（`src/api/types.ts`・`src/api/rooms.ts`）を突き合わせ、断面①承認のために人間が
> 確認すべき点を一覧化する。**最大の論点は、一覧レスポンスをオブジェクトでラップするか（yamlの
> `RoomListResponse`）、素の配列で返すか**であり、本ファイルはこれを**yamlのラッパー形状を正とし、
> フロントは内部で剥離して呼び出し側には`RoomSummary[]`を渡す**という裁定で決着させる（下記2節）。
> あわせて、`meta/adr/0025`・`reservation-frontend/adr/0008`（いずれも本PR同梱）が定める
> 「SSoTは1つ・フロントは写しを持たず導出する」原則の初適用として、`types.ts`の現状（写しであって
> 導出ではない）を記録する。

対象:
- SSoT: `projects/reservation-system/contracts/reservation-api.yaml`のRSV-L追記ブロック
  （ドラフト、2026-07-22、人間承認待ち）・`projects/reservation-system/adr/0007`（裁定、ドラフト）
- フロントの写し: `projects/reservation-frontend/src/api/types.ts`（`RoomSummary`型）・
  `projects/reservation-frontend/src/api/rooms.ts`（`listRooms()`、現状はモック実装）
- 関連: `meta/adr/0025`（クロスプロジェクトのSSoT一元化）、`reservation-frontend/adr/0008`
  （L3導出方針、ADR-0007をsupersede）

日付: 2026-07-26

---

## 1. 突き合わせ表(フィールド単位)

| # | yaml(SSoT、RoomSummary) | types.ts(RoomSummary) | 一致 |
|---|---|---|---|
| 1 | `roomId: string` | `roomId: string` | 一致 |
| 2 | `name: string`（会議室の表示名） | `name: string`（コメント: 「予約者の氏名等の個人情報とは無関係」） | 一致 |
| 3 | `businessHoursStart: string`（`HH:mm`パターン） | `businessHoursStart: string`（コメント: 「営業時間の開始時刻(HH:mm)」） | 一致 |
| 4 | `businessHoursEnd: string`（同上） | `businessHoursEnd: string`（同上） | 一致 |
| 5 | `capacity: integer`（`minimum: 1`） | `capacity: number` | 一致（下限1の制約は型では表現されない。実装時にバリデーションが必要なら別途) |
| 6 | `minReservationDurationMinutes`を**含めない**（システム共通・`/rules`に一元化、adr/0007決定2） | 該当フィールドなし（一致） | 一致 |
| 7 | レスポンス全体は`RoomListResponse = { rooms: RoomSummary[] }`（オブジェクトでラップ、解釈ポイント(3)） | **`RoomListResponse`型が存在しない**。`listRooms(): Promise<RoomSummary[]>`が素の配列を直接返す | **不一致（本ファイルの主題）** |

**結論**: `RoomSummary`単体のフィールドはyamlとフロントで完全に一致している。唯一の不一致は
レスポンスの入れ物（ラッパーの有無）であり、下記2節で裁定する。

---

## 2. 裁定: ラッパー(RoomListResponse) vs 素の配列

### 2.1 論点

- yaml（SSoT、ドラフト）: `GET /rooms` → `RoomListResponse = { "rooms": [ RoomSummary… ] }`
  （オブジェクトでラップ）。理由（`reservation-api.yaml`解釈ポイント(3)、`reservation-system/
  adr/0007`決定6）: 既存の全レスポンス（`ReservationResponse`・`AvailabilityResponse`・
  `RoomRulesResponse`）がいずれもオブジェクトである既存パターンとの整合、および将来のページング・
  件数等メタデータ追加への拡張余地
- フロント手書き（`src/api/rooms.ts`）: `listRooms(): Promise<RoomSummary[]>`。**素の配列**を
  返す。`RoomListResponse`型は`types.ts`に存在しない

### 2.2 裁定: yamlのラッパー形状を正とする。フロントは内部で剥離し、公開シグネチャは変えない

**yaml（SSoT）のラッパー形状（`RoomListResponse`）を正とする。** 理由:

1. **一貫性**: 一覧・単体を問わず、reservation-systemの全レスポンスは一貫してオブジェクトである
   （`ReservationResponse`・`CancelledReservationResponse`・`AvailabilityResponse`・
   `RoomRulesResponse`）。ここだけ素の配列にすると、この1エンドポイントだけが例外的な形状になる
2. **拡張余地**: 将来ページング・件数・絞り込み結果メタデータ等を追加する必要が生じた場合、
   オブジェクトであれば既存フィールド（`rooms`）を変えずに新しいキーを追加できる（後方互換）。
   素の配列だとレスポンス全体の型を破壊的に変更するほかない
3. **フロントは公開シグネチャを変えずに吸収できる**: `listRooms()`の**呼び出し側**が実際に必要と
   しているのは`RoomSummary[]`（一覧を反復・ソートして描画する）であり、レスポンスの入れ物が
   オブジェクトか配列かではない。したがって`listRooms()`の内部実装だけを「`RoomListResponse`を
   受け取り、`.rooms`を返す」という**アダプタ層**に変えれば、呼び出し側（`Promise<RoomSummary[]>`
   を期待するコード）には一切変更が要らない。ラッパーは**破壊的な衝突ではない**

このため、「フロントが必要とする形」と「SSoTが保管する形」は分離できる（`meta/adr/0025`が定める
「形を決める権利」と「形を保管する場所」の分離そのものの適用例）。フロントの必要（素の配列で扱いたい）
は`listRooms()`の**内部**で満たせばよく、SSoTのラッパー形状を変える理由にならない。

**yaml側の修正提案は無し**。現行のRSV-Lドラフト（`RoomListResponse`によるラップ）をそのまま断面①の
承認対象とすることを提案する。

### 2.3 この裁定が要求する変更(断面①承認後、断面②で実施。今は実装しない)

- `types.ts`に`RoomListResponse`型を追加する（`reservation-system/adr/0007`・yaml解釈ポイント(3)
  に対応）。生成（`reservation-frontend/adr/0008`が推奨）を採用する場合は、この型は生成物として
  自動的に得られる
- `rooms.ts`の`listRooms()`は、実バックエンドconform時、`RoomListResponse`を受け取り`.rooms`を
  返すアダプタとして実装する。**公開シグネチャ`Promise<RoomSummary[]>`は変更しない**（呼び出し側の
  コードに影響なし）
- 現状のモック実装（`MOCK_ROOMS`を直接ソートして返す）は、上記アダプタの内側に一段包む形で
  引き続き使ってよい（モックデータの中身自体は変更不要）

---

## 3. 解釈ポイント8件(yaml)との整合確認

`reservation-api.yaml`のRSV-L追記ブロックが持つ解釈ポイント(1)〜(8)（`reservation-system/adr/0007`
と対応）を、フロント側の必要・実装（`BookingDesign.tsx`・reconciliation`booking-design-
reconciliation.md`項目1・7・19）と突き合わせる。

| # | 解釈ポイント(yaml) | フロント側との整合 |
|---|---|---|
| (1) | `minReservationDurationMinutes`を一覧に含めない（`/rules`に一元化） | 整合。フロントは最小予約時間を予約フォームの検証時に`/rules`から個別取得する設計であり（`booking-design-reconciliation.md`10節）、一覧取得時点では不要 |
| (2) | `name`は新設列ではなく、公開APIで初めて露出するだけ | 整合。`types.ts`の`RoomSummary.name`はコメントで「予約者の氏名等の個人情報とは無関係」と明記しており、フロントもこの区別を認識している |
| (3) | レスポンスは`RoomListResponse`でラップ | 本ファイル2節で裁定済み（ラッパーを正とし、フロントが内部で吸収） |
| (4) | 並び順はname昇順 | 整合。`rooms.ts`の`listRooms()`は`[...MOCK_ROOMS].sort((a, b) => a.name.localeCompare(b.name, "ja"))`で既に同じ順序を実装している |
| (5) | 0件時は200+空配列(`rooms: []`) | フロント未実装（モックは常に固定件数を返す、`rooms.ts`のコメントに明記）。0件表示のUI（空状態）自体は`booking-design-reconciliation.md`項目17・19が「設計調整で足りる」に分類済みで、断面②の実装課題として別途扱う |
| (6) | 予約者の識別を要求しない(認証なし) | 整合。`reservation-frontend/adr/0006`（案B・無認証）と矛盾しない |
| (7) | クエリパラメータ(絞り込み)を持たない | 整合。フロント側も現時点で絞り込みUIを持たない |
| (8) | `/rooms`(一覧)と`/rooms/{roomId}/rules`(予約前詳細)の役割分担 | 整合。`booking-design-reconciliation.md`10節が同じ役割分担（一覧は`ROOMS`配列の置き換え、`/rules`は最小予約時間の個別取得）を前提に設計調整を整理済み |

**結論**: 解釈ポイント8件のうち、フロント側の設計・実装と矛盾するものは無い。(5)（0件時の空状態UI）
は断面②の実装課題として既に分類済み（新規の論点ではない）。

---

## 4. 断面①承認のために人間が確認すべき点(一覧)

1. **RSV-Lの解釈ポイント(1)〜(8)**（`reservation-api.yaml`・`reservation-system/adr/0007`）:
   本ファイル3節の通りフロント側との矛盾は無いが、契約自体の妥当性（バックエンド側の断面①承認）は
   本ファイルの管轄外であり、`reservation-system/activeContext.md`が追跡する別の承認事項として
   残っている
2. **ラッパー(RoomListResponse) vs 素の配列の裁定**（本ファイル2節）: yamlのラッパー形状を正とし、
   フロントは内部アダプタで吸収する、という裁定への同意。同意しない場合はyaml側の修正
   （ラッパー撤回）を別途検討する必要がある
3. **生成 vs 契約テストの選択**（`reservation-frontend/adr/0008`）: architectは生成
   （`openapi-typescript`）を推奨するが、最終選択は人間承認事項。本ファイルの2.3節の変更内容は
   どちらを選んでも実施が必要（生成なら型は自動で得られる、契約テストなら手書きの型に本節の追記が
   要る）
4. **`meta/adr/0025`（SSoTは1つ、フロントは写しを持たない）の一般原則**: 本ファイルはこの原則の
   初適用例であり、承認されれば以後のクロスプロジェクト契約すべてに適用される運用ルールになる
5. **本ファイルが提案する変更は実装しない**: 断面①（契約・SSoT一元化の原則そのものの承認）と
   断面②（`types.ts`へのラッパー型追加・`rooms.ts`のアダプタ化）は別の段階であり、本ファイルは
   断面①の承認材料としてのみ提出する。断面②の実装はRSV-L契約の断面①承認後、次スライドで
   developerが行う

---

## 5. 整合が確認できた点(参考。分類対象ではない)

- `RoomSummary`の個々のフィールド（`roomId`・`name`・`businessHoursStart`・`businessHoursEnd`・
  `capacity`）は、yamlとフロントの手書き型で完全一致している。ドリフトはレスポンスの入れ物
  （ラッパーの有無）に限定されており、フィールド単位のドメインモデルの齟齬は無い
- 並び順（name昇順）・0件時の意味論（空一覧≠会議室不存在）は、フロント側の実装
  （`rooms.ts`のソート処理）・reconciliation（`booking-design-reconciliation.md`）のいずれとも
  矛盾しない
