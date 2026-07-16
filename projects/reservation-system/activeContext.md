# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-16

## 今どこにいるか(スライスRSV-A)

スライスRSV-A「空き枠を確認できる」の契約が承認された(2026-07-16、シナリオRSV-A-01〜07 + API改訂 GET /rooms/{roomId}/availability)。初のクエリ側スライス(CQRSの読み側)。人間裁定はADR-0006(空き枠は予約可能な空きのみ=最小予約時間未満の隙間を除外)。developer(実装+単体テスト、L1〜L3)とtester(step定義+DSL、L4)の並行作業(ブランチslice/rsv-a)。

developer側は完了: domain(AvailabilityCalculator、TimeSlot.meetsMinimumDurationを公開してADR-0006のルールをドメイン1箇所に保つ)・application(RoomAvailabilityService)・adapter/api(RoomAvailabilityController、GET /rooms/{roomId}/availability)を実装。既存のrooms/reservationsテーブルとReservationRepository.findActiveByRoomAndDate(cancelled_at IS NULL絞り込み)をそのまま読み取りに再利用し、永続化層(persistence)の変更は不要だった。L1(単体+lint)/L2(ArchUnit)/L3(WebMvcTest契約+実DB統合テスト)全緑、pitest全域100% kill(閾値70%)。次はtesterのL4完走→reviewer監査→人間承認。

このスライスは2つの新規規程の初適用: ADR-0007(L4のThen検証にAPIスキーマ機械照合を組み込む=DSL側のtester作業)、ADR-0008(seam仕様はcontracts/test-support-api.yamlを原文参照)。orchestratorのディスパッチはrouting限定(ADR-0011)。

## 完了済みスライス

- RSV-C「予約を作成できる」: 全段緑・PR #1マージ済み(2026-07-14)
- RSV-K「予約をキャンセルできる」: 全段緑・PR #5マージ済み(2026-07-15)。reviewer差し戻し→修正→再監査のループを完走

## 確定した主要な判断

- ドメインモデルパック(ADR-0001)/ Java+Spring Boot+JPA(ADR-0002)
- ドメイン設計はDDDワークの判断群に従う(docs/workshop-summary-01-reservation.md): 小さいReservation集約 + DB排他制約(EXCLUDE, btree_gist, WHERE cancelled_at IS NULL)、半開区間[start,end)、営業時間・定員はスナップショット、状態は導出(ReservationStatus.of())、Clock注入
- 予約者は社員に限定しない(ADR-0003)。日マタギは構造的禁止(ADR-0004)。キャンセルは本人のみ(ADR-0005)
- 空き枠は予約可能な空きのみ返す(ADR-0006)
- seam: POST /test-support/rooms(roomId応答) / DELETE /test-support/reservations(clockもリセット) / PUT /test-support/clock。acceptance限定。正式仕様はcontracts/test-support-api.yaml

## 進行中 / 次にやること

1. スライスRSV-A: 人間承認3点(契約・裁定・step実装)完了、L1〜L4全緑。残りはPR → CI → 人間マージ
2. **次スライスの宿題(RSV-A監査の要確認注記より。ADR-0009に従いarchitectが次の契約起草時に確認する)**:
   - (a) スキーマ照合が契約yamlの手写しになっている二重管理リスク。**orchestratorがbuild.gradleにOpenAPI/JSON Schemaバリデータ依存を追加し**、testerがyaml原本と直接照合する形に直す(現状はbuild.gradle変更不可の制約下でtesterが手写し照合器を自作した)
   - (b) スキーマ照合が予約作成・キャンセルの成功応答に未適用(ADR-0007の理念上は全成功応答に広げる)
   - (c) stepクラス名`ReservationCreateSteps`の乖離が3スライス目で悪化。クラス分割を検討(Cucumberのglueインスタンス共有制約があるため、DI(cucumber-picocontainer)追加の要否も併せて判断)
3. 次スライス候補: 「会議室の予約ルールを確認できる」(営業時間・定員・最小予約時間をまとめて公開。ADR-0006で先送りした論点。現在これらは本番の公開読み取り口が無い)
4. 中期: B層「ドメインモデルパック実体」を本プロジェクトの実証済み部品から抽出

## 環境メモ

- JDK: Amazon Corretto 23(JAVA_HOME明示が必要)。ビルド: Gradle wrapper 8.14
- コンテナ: Podman稼働。統合テストは DOCKER_HOST=npipe:////./pipe/podman-machine-default, TESTCONTAINERS_RYUK_DISABLED=true。手動コンテナはlocalhost転送されず、SUT起動時はWSLのIP(`podman machine ssh "ip -4 addr show eth0"`)へ接続

## 直近のfriction

- FR-001〜009 記録済み(friction-log.md)。FR-002〜009は対応済み(規程/雛形/契約へ押し込み完了)。FR-001(HANDOFF参照素材の所在)のみ未対応(実害なし)
