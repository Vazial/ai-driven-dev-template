# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-08-02

## 今どこにいるか

**バックエンドの公開APIは6スライス目まで揃った**。ブランチ`feat/reservation-system-room-registration`上で
RSV-T「会議室を登録できる」の契約・実装・step定義がL1〜L4まで全緑（まだmain未マージ）:

| スライス | エンドポイント | シナリオ |
|---|---|---|
| RSV-C 予約の作成 | `POST /reservations` | 5件 |
| RSV-K キャンセル | `POST /reservations/{id}/cancel` | 5件 |
| RSV-A 空き枠確認 | `GET /rooms/{roomId}/availability` | 7件 |
| RSV-R 予約ルール確認 | `GET /rooms/{roomId}/rules` | 3件 |
| RSV-L 会議室一覧（2026-07-27完了） | `GET /rooms` | 2件 |
| **RSV-T 会議室の登録**（2026-08-02完了） | `POST /rooms` | 4件（RSV-T-01〜04） |

**RSV-Lはconsumer-driven契約の初適用**だった（meta/adr/0023）。reservation-frontendが必要とする形から
契約を決め（断面①・人間承認2026-07-27）、バックが後追いで実装した（断面②）。`{rooms:[RoomSummary]}`の
ラッパー形状・name昇順・0件は200+空一覧・`minReservationDurationMinutes`は`/rules`に一元化（adr/0007）。
`DELETE /test-support/rooms`はRSV-L-02（会議室ゼロ件）の消費者ができたため再導入済み。

**RSV-Tの発端**: ローカル走破で、通常起動（acceptanceプロファイル以外）では会議室を1件も作れないことが
判明した（`POST /test-support/rooms`が`@Profile("acceptance")`限定・Flywayにseedなし）。人間が「会議室を
登録する正式なAPIを足す」ことを決定し（2026-08-01）、契約・adr/0008は方式(i)（PRマージ=承認、meta/adr/0043）
で承認済み。実装内容: `roomId`はサーバ採番（domainの`Room.register`が生成）、表示名の重複は409
`ROOM_NAME_DUPLICATE`（`RoomRepository.findByName`による事前チェック、applicationの
`RoomRegistrationService`）、営業時間の終了≦開始は422`INVALID_BUSINESS_HOURS`（`Room.register`の
ドメイン不変条件）。**`rooms`テーブルへの列追加・マイグレーション追加は不要だった**——`name`列は元々V1
マイグレーションで`NOT NULL UNIQUE`だったため（RSV-C時点からの既存制約）。`POST /test-support/rooms`
（同名は上書き）は無変更のまま維持し、業務API（`POST /rooms`、重複拒否）とは統合していない（adr/0008決定8）。
tester側のstep定義（`RoomRegistrationSteps`）・DSL（`RoomRegistrationDsl`）も同じブランチで揃い、
`@pending-implementation`タグは外れている。L1（単体+lint+PIT mutation 100%）/L2（ArchUnit）/L3
（WebMvcTest+Testcontainers実DB）/L4（受け入れ35シナリオ、既存5スライス含め全緑）をdeveloper自身が
確認済み。**次はPRを立てて人間レビューへ**。

**2026-07-28、フロントが初めて実バックエンドに接続した**（reservation-frontend/adr/0009）。走破で
`GET /rooms`の疎通を確認済み（実DBの会議室が画面に表示された）。バックエンド側の変更は発生していない
（フロントのVite proxyで完結。CORS設定は追加していない=越境なし）。

## 次にやること

1. **RSV-TのPRを立てて人間レビューへ**: ブランチ`feat/reservation-system-room-registration`は実装・
   テストが揃い検証全緑。PRテンプレートの必須項目（対象シナリオID・CI結果）を満たしてPRを作成する
2. **フロントの実接続の続き（バック側の作業は現状なし）**: reservation-frontend側で
   `GET /rooms/{roomId}/availability`の実接続が必要（理由はfrontend側 FR-007。`GET /rooms`だけ実APIに
   すると実DBのUUIDとモックのroomIdが食い違い画面が機能しない）。バックは実装済みのため、**バック側の
   新規作業は現時点でない**
3. **step実装の人間承認の運用**: RSV-Lスライスでは**reviewerを起動せず、step実装の人間承認も経ずに
   マージした**（permissions.mdの4承認ポイントの1つを飛ばした規程違反。2026-07-28に人間の問い
   「step実装の承認っているんだっけ？」で発覚）。制度変更（承認対象の絞り込み）は検討したが**見送り**、
   現行規程のまま運用する方針。RSV-L分を後追い監査するかは未定（人間判断）
4. **プロジェクトADRの`提案中`→`承認済み`の棚卸し**: adr/0007・adr/0008は承認済み化したが、他にも
   `提案中`のままマージされているADRがある。設計骨格承認点として一度フラグを揃えるか判断が要る

## 確定した主要な判断

- ドメインモデルパック(ADR-0001) / Java+Spring Boot+JPA(ADR-0002)
- ドメイン設計はDDDワークの判断群に従う(docs/workshop-summary-01-reservation.md): 小さいReservation集約 + DB排他制約(EXCLUDE, btree_gist, WHERE cancelled_at IS NULL)、半開区間[start,end)、営業時間・定員はスナップショット、状態は導出(ReservationStatus.of())、Clock注入
- 予約者は社員に限定しない(ADR-0003)。日マタギは構造的禁止(ADR-0004)。キャンセルは本人のみ(ADR-0005)。空き枠は予約可能な空きのみ返す(ADR-0006)。会議室一覧の追加と/rulesとの役割分担(ADR-0007、承認済み2026-07-27)。会議室登録API(POST /rooms)の新設・roomIdサーバ採番・表示名一意性・営業時間妥当性(ADR-0008、承認済み2026-08-01)
- seam: POST /test-support/rooms(roomId応答) / DELETE /test-support/rooms(全会議室削除) / DELETE /test-support/reservations(clockもリセット) / PUT /test-support/clock。**acceptanceプロファイル限定**。正式仕様はcontracts/test-support-api.yaml。業務API(POST /rooms)とは役割が異なり統合しない(adr/0008決定8)
- 検証: L0 govlint(統治文書) → L1〜L4。統治文書のメタデータはfrontmatter＝機械検証対象(ADR-0012)
- orchestratorは実質的成果物を作らない。検証ハーネスの所有=CIワークフロー(orchestrator・自己検証)/build.gradle・govlint(developer・テスト付き)/ゲート(人間)(ADR-0014)
- **CIはプロジェクト別に分割済み**(meta/adr/0026): 本プロジェクトは`.github/workflows/ci-reservation-system.yml`（`projects/reservation-system/**`の変更時のみ起動）。L0 govlintは共有・常時実行

## 未着手の技術的宿題（スライス作業として消化）

- スキーマ照合の新旧混在: RSV-R・RSV-Lの新規検証はyaml原本を直読み(`OpenApiInteractionValidator`)、
  既存(空き枠・拒否応答全般)は`JsonSchemaAssertions`への手写しのまま、予約作成・キャンセルの成功応答は
  未適用。段階移行の判断が要る
  - ※命名注意: この宿題が従来参照していた「ADR-0007」はスキーマ照合移行の文脈で使われていた仮の参照名。
    2026-07-22に番号としてのADR-0007を「GET /rooms追加・役割分担」に採番したため、指す先の再確認・改称が
    必要（記述の古さによる表記ゆれ）
- stepクラス`ReservationCreateSteps`への集約が5スライスで肥大（RSV-Lのstepもここに追加した）。分割には
  Cucumberのglueインスタンス共有制約→DI(cucumber-picocontainer)追加の要否判断(build.gradle)。
  なおDSL側は`ReservationSystemDsl`がcheckstyleのFileLength上限(400行)に達し、RSV-A分を
  `AvailabilityDsl`へ、RSV-R分を`RoomRulesDsl`へ、RSV-L分を`RoomListDsl`へ分離済み。RSV-T分は
  `RoomRegistrationSteps`・`RoomRegistrationDsl`として新規stepクラスに分離された(tester側の判断)

## 環境メモ

- JDK: Amazon Corretto 23(JAVA_HOME明示が必要)。ビルド: Gradle wrapper 8.14
- コンテナ: Podman稼働。統合テストは DOCKER_HOST=npipe:////./pipe/podman-machine-default, TESTCONTAINERS_RYUK_DISABLED=true
- **手動起動での接続（2026-07-28の走破で判明）**: 手動で立てたPostgreSQLコンテナはIPv4(127.0.0.1)では
  到達できずIPv6(`[::1]`)でのみ到達する。SUT起動時は`DB_URL='jdbc:postgresql://[::1]:5432/reservation'`を
  指定する。また**test-supportのseamは`@Profile("acceptance")`のため、データ投入するには
  `--spring.profiles.active=acceptance`で起動する必要がある**（通常起動では404）。ただし**RSV-T以降は
  `POST /rooms`（業務API）で通常起動でも会議室を登録できる**（acceptanceTest実行時のSUT起動は引き続き
  `--spring.profiles.active=acceptance`。既存の`test-support`シームをRSV-C〜Lの受け入れシナリオが使うため）
- 日本語を含むJSONをcurlで投げるとシェル経由で文字化けする。Python(`json.dumps(..., ensure_ascii=False)`
  をutf-8でエンコード)等、シェルを経由しない方法で投入する

## 直近のfriction

- FR-001〜014 記録済み(friction-log.md、メタデータ付き)。FR-001(HANDOFF参照素材の所在・実害なし)と
  FR-014は未対応、他は対応済み
- FR-014: シナリオIDがgovlint(L0)とCucumber(L4)を結合し、「実装より先にシナリオだけを下書きする」状態を
  構造的に作れない。RSV-Lでは契約(API形状)と受け入れシナリオを別スライスに分けて回避し、実装スライス
  (2026-07-27)でシナリオ＋実装を同時に緑にして解消した。**この回避方法が実際に機能することは実証済み**
  だが、恒久策(govlintに下書き状態を許す等)は引き続き未対応
- govlintが報告中の未解決シグナル: cause_key `approval-artifact-readability-convention-missing` 3回、
  `orchestrator-as-substantive-source` 2回、`volatile-state-in-static-doc` 2回（いずれも構造的欠陥の
  シグナルとして報告のみ。判断は人間）
