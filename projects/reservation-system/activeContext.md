# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-16

## 今どこにいるか(スライスRSV-R)

スライスRSV-R「会議室の予約ルールを確認できる」の契約が承認された(2026-07-17、シナリオRSV-R-01〜03 + API追記 GET /rooms/{roomId}/rules)。ADR-0006で先送りした「最小予約時間のクライアント露出」の回収。公開するのは営業時間・定員・最小予約時間の3点で、**キャンセル期限は含めない**(人間裁定 2026-07-17: 利用側アプリが必要としたら別スライスで。P-02)。developer/testerの並行作業(ブランチslice/rsv-r)。

developer側は完了: domain(TimeSlotに`minimumDurationMinutes()`を追加。既存のMIN_DURATIONをそのまま読むだけで値を複製しない、ADR-0006の「ドメイン1箇所に保つ」方針を継続)・application(GetRoomRulesQuery/RoomRules/RoomRulesService。既存のRoomRepository・RoomNotFoundExceptionをRSV-Aからそのまま再利用)・adapter/api(RoomRulesController、RoomRulesResponse、GET /rooms/{roomId}/rules。404はApiExceptionHandlerの既存ROOM_NOT_FOUND処理を無変更で再利用)を実装。新規テーブル・persistence層の変更は不要(design.mdの見立て通り、roomsテーブルの既存読み取りのみ)。
L1(単体テスト: TimeSlotTest/RoomRulesServiceTest + lint)/L2(ArchitectureTest)/L3(RoomRulesApiContractTest=WebMvcTest契約 + RoomRulesEndToEndIntegrationTest=実DB統合テスト、Podman経由で実行確認済み)全緑。pitest対象(domain+application)全域100% kill(閾値70%、53/53 mutation killed)。build.gradle変更なし。次はtesterのstep定義+DSL→L4完走→reviewer監査→人間承認。

## 前スライスの到達点(RSV-A)

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

1. スライスRSV-R: 人間承認3点(契約・裁定・step実装)完了、L1〜L4全緑(29シナリオ)。残りはPR → CI → 人間マージ
2. **次スライスの宿題(RSV-R監査の要確認注記より。ADR-0009に従いarchitectが次の契約起草時に確認する)**:
   - (a) 解消済み: スキーマ照合の二重管理 → orchestratorがswagger-request-validator-restassuredを追加。RSV-Rの新規検証は契約yaml原本を直読みする方式に。ただし**部分解消**(下記b)
   - (b) スキーマ照合が新旧混在: 既存のRSV-A空き枠確認・拒否応答全般は手写し方式のまま、予約作成・キャンセルの成功応答は未適用。全面移行はblast radius(承認済み全スライスに波及)を理由に見送り済み。段階移行の判断が必要
   - (c) stepクラス`ReservationCreateSteps`への集約が4スライス目でさらに拡大(未解消・継続)。クラス分割にはCucumberのglueインスタンス共有制約があり、DI(cucumber-picocontainer)追加の要否判断が要る(build.gradle変更=orchestrator領分)
   - (d) 新規: room ID解決ロジックの重複(RSV-R監査で指摘)
   - (e) 新規: **reviewerの独立性の盲点** — コミット履歴を読まない制約上、「build.gradleの変更が正しい主体(orchestrator)によるものか」を判断できなかった。バッチ#3の材料
4. **規程改善バッチ#3(RSV-R完了後に着手。人間と合意済み 2026-07-16)**: 統治文書のメタデータをスキーマ化し、手作業の判定を機械化する。P-03/P-04をテンプレート自身の成果物に適用する話
   - friction-logに構造化メタデータ(id/date/found_at/cause/slice/pushed_to/status/principles)をfrontmatterで持たせ、**「同原因2回=構造的欠陥」の検出を機械化**(現在はorchestratorの目視。FR-006で1回取りこぼした実績あり)。未対応FRの棚卸しも機械化
   - ADRに構造化メタデータ(id/status/supersedes/superseded_by/scope/relates_to)を持たせ、状態・置き換えリンク・参照先の実在をlintで検証
   - 契約⇔ADR⇔シナリオIDの相互参照lint(現在はID繰り上げ等を手作業でやっている)
   - **prose部分(ADRの文脈・代替案・帰結、friction の事象・原因考察)は文章のまま残す**。P-03が「上位2つで表現できないもの=理由・経緯・判断は文章に置く」と言っているため。構造化するのはメタデータのみ(ハイブリッド)
   - lintはCI(L1相当)に1ジョブとして追加する想定
5. 中期: B層「ドメインモデルパック実体」を本プロジェクトの実証済み部品から抽出

## 環境メモ

- JDK: Amazon Corretto 23(JAVA_HOME明示が必要)。ビルド: Gradle wrapper 8.14
- コンテナ: Podman稼働。統合テストは DOCKER_HOST=npipe:////./pipe/podman-machine-default, TESTCONTAINERS_RYUK_DISABLED=true。手動コンテナはlocalhost転送されず、SUT起動時はWSLのIP(`podman machine ssh "ip -4 addr show eth0"`)へ接続

## 直近のfriction

- FR-001〜009 記録済み(friction-log.md)。FR-002〜009は対応済み(規程/雛形/契約へ押し込み完了)。FR-001(HANDOFF参照素材の所在)のみ未対応(実害なし)
