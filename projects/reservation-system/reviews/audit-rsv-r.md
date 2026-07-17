# 監査レポート: RSV-R「会議室の予約ルールを確認できる」

> **人間承認の記録（orchestrator追記）: 承認 2026-07-17**。承認材料は本レポートの「0. 承認者向けサマリ」。
>
> 要確認注記への回答:
> - 注記1（build.gradle変更の主体が判断できない）: **解消**。この依存追加はorchestratorがtester着手前に実施したもので、規約通りの手順（activeContext宿題(a)の想定通り）。reviewerは独立性の制約（コミット履歴を読まない）から判断できず、正しく「判断できない」と明記した。この盲点自体は規程改善バッチ#3の材料とする
> - 注記2（スキーマ照合の新旧混在）: 承認時に認識済み。全面移行はblast radius（承認済み全スライスに波及）を理由に見送られた妥当な判断（P-02）。次スライス以降の宿題として継続
> - 注記3（stepクラスへの集約拡大）: 未解消のまま継続。次スライス以降の宿題

- 作成: reviewer
- 監査対象: `git diff origin/main -- projects/reservation-system/src/acceptanceTest/`（RSV-A承認時点=origin/mainからの新規・変更分のみ）
  - `dsl/RoomRulesDsl.java`（新規）
  - `dsl/ReservationSystemDsl.java`（変更。RSV-C/RSV-K/RSV-A分の本体は無変更、RSV-R用の委譲メソッド4個追加+スキーマ定数3個を`JsonSchemaAssertions`へ移設）
  - `dsl/JsonSchemaAssertions.java`（変更。`ReservationSystemDsl`から移設されたスキーマ定数3個をpublicフィールドとして受け入れ。検証ロジック自体は無変更）
  - `steps/ReservationCreateSteps.java`（変更。RSV-C/RSV-K/RSV-A分のstep本体は無変更、javadocとRSV-R分のstep4個追加）
  - （付随して`build.gradle`に依存追加あり。steps/dslの範囲外だが、ADR-0007充足の可否に直結するため3節・4節で扱う）
- 突き合わせた契約: `contracts/reservation-rules.feature`（RSV-R-01〜03）、`contracts/reservation-api.yaml`のRSV-R追記部分（`/rooms/{roomId}/rules`・`RoomRulesResponse`）。既存step再利用の確認に`reservation-create.feature`・`reservation-cancel.feature`・`reservation-availability.feature`、seam仕様の確認に`test-support-api.yaml`も参照
- 注意: 本レポートはtesterの意図説明・コミットメッセージ・コード中の「〜のため」という理由コメントを判断材料にせず、コードの動作のみから作成した（agents.md 3節、PRINCIPLES.md）。実装コード（src/main、src/test）・design.mdも参照していない
- 前回監査: `reviews/audit-rsv-a.md`（RSV-A、承認済み）。申し送り注記の解消/発火状況は「4. 申し送り注記」参照

---

## 0. 承認者向けサマリ（人間はまずここだけ読む）

**結論**: 承認材料が揃った

**平易版対訳表**（1行1step、業務の言葉のみ）

| シナリオの文 | テストが実際にやること | 一致 |
|---|---|---|
| 予約者が会議室の予約ルールを確認する | 指定した会議室について、予約ルールを尋ねる問い合わせを行い、応答を記録する。誰が確認するかは伝えない。会議室が用意されていなければ、実在しないIDで問い合わせて「見つからない」応答を引き出す | ✅ |
| 営業時間は開始時刻から終了時刻であることが返る | 応答が正常で、返ってきた項目に過不足・型のズレがないことを確認したうえで、営業時間の開始・終了が指定した時刻と一致することを確かめる | ✅ |
| 定員はN人であることが返る | 同様に応答が正常・過不足なしであることを確認したうえで、定員が指定した人数と一致することを確かめる | ✅ |
| 最小予約時間はN分であることが返る | 同様に応答が正常・過不足なしであることを確認したうえで、最小予約時間(分)が指定した値と一致することを確かめる | ✅ |
| 予約ルールの確認は「理由」という理由で拒否される | 応答が指定の理由（この契約では「会議室が存在しない」→404）で拒否されたことを確かめる。予約作成・キャンセル・空き枠確認の拒否確認と同じ仕組みを共用している | ✅ |

**要確認の注記**:
- 本差分には`build.gradle`への依存追加（OpenAPI応答検証ライブラリ）が含まれている。`build.gradle`冒頭のコメントは「依存追加が必要な場合、testerは変更せずエスカレーション」と定め、activeContext.mdの宿題(a)も「orchestratorが追加する」という想定だった。reviewerはコミット履歴・testerの説明を参照しない独立性の制約上、この追加が正しい手順（orchestrator経由）で行われたかを確認できない。機能的には正しく動作すること（後述、実機検証済み）は確認したが、手順面は人間の確認を推奨する
- ADR-0007（応答のスキーマ機械照合）は本差分でRSV-Rの成功応答にのみ「契約yaml原本を直接読む」方式で新たに適用された。一方、既存のRSV-A空き枠確認・拒否応答全般はこのスライスの変更対象外として、従来の「yamlからの手動転記」方式のまま据え置かれている（RSV-A監査からの申し送り(a)は部分解消にとどまる）。また予約作成・キャンセルの成功応答は今回も対象外のまま（申し送り(b)は未解消で継続）。詳細は4節

---
以下は監査の証跡。承認者は原則サマリだけで判断できる。疑わしい行があれば該当の詳細に潜る。

## 1. 対訳表（技術詳細）

新規・変更されたstepのみ。「実際に行うこと」はシナリオを見る前にコードから書き起こした。

| # | シナリオ文 / 対象 | このコードが実際に行うこと | シナリオとの一致 |
|---|---|---|---|
| R1 | When 予約者が"◯◯"の予約ルールを確認する | `ReservationSystemDsl.checkRoomRules`: `roomIdByName`（Backgroundの`会議室が存在する`が積んだ会議室名→ID）から名前を引き、見つかれば実IDを、見つからなければ`does-not-exist-room-`+ランダムUUIDを使う（`checkAvailability`と全く同じ組み立てロジックをそのまま複製、共通化はされていない）。解決したIDを`RoomRulesDsl.checkRoomRules`に渡し、`GET /rooms/{roomId}/rules`（クエリパラメータなし）を呼んで応答を記憶する。成否判定はしない | ✅ RSV-R-03「存在しない会議室」はGivenで作られないため`roomIdByName`に無く、自動的に実在しないIDで問い合わせる設計。RSV-A-07と同型 |
| R2 | Then 営業時間は"HH:MM"から"HH:MM"であることが返る | `RoomRulesDsl.assertBusinessHours`: (1)応答ステータス200を検証、(2)契約ファイル`contracts/reservation-api.yaml`原本を`OpenApiInteractionValidator`でパースし、`GET /rooms/{roomId}/rules`の200応答スキーマ（`RoomRulesResponse`: roomId/businessHoursStart/businessHoursEnd/capacity/minReservationDurationMinutesが必須、過不足なし）に適合することを機械照合、(3)`businessHoursStart`/`businessHoursEnd`が指定した開始・終了時刻と一致することを検証する | ✅ |
| R3 | Then 定員は{int}人であることが返る | `RoomRulesDsl.assertCapacity`: R2と同じ(1)(2)の再検証のうえで、`capacity`が指定人数と一致することを検証する | ✅ |
| R4 | Then 最小予約時間は{int}分であることが返る | `RoomRulesDsl.assertMinReservationDuration`: R2と同じ(1)(2)の再検証のうえで、`minReservationDurationMinutes`が指定分数と一致することを検証する | ✅ |
| R5 | Then 予約ルールの確認は"◯◯"という理由で拒否される | `ReservationSystemDsl.assertReservationRejected`をそのまま呼ぶ（RSV-C/RSV-K/RSV-A既存メソッドの**再利用**、無変更）。既存の拒否理由対応表`REJECTION_BY_REASON`から"会議室が存在しない"→(404, ROOM_NOT_FOUND)を引き、ステータス・`ProblemResponse`スキーマ適合（`JsonSchemaAssertions`の手動転記版）・`code`・`message`非空を検証する。新規の対応表エントリ追加は無し（RSV-Aで既に登録済みのROOM_NOT_FOUNDをそのまま再利用） | ✅ reservation-api.yamlのRSV-R追記「ROOM_NOT_FOUNDはRSV-Aで定義済みのコードを再利用」と一致 |
| R6（新規クラス） | `RoomRulesDsl` | RSV-R専用の協働クラス。静的フィールドとして`OpenApiInteractionValidator.createFor("contracts/reservation-api.yaml").build()`を1回だけ生成し使い回す。この生成が実際に成功しファイルを正しく読み込めるかを、Gradleのデフォルト作業ディレクトリ(`projects/reservation-system`)を再現したスタンドアロン実行で検証した（下記「機械検証」参照） | ✅ 実機検証で確認済み |
| R7（既存コード移設） | `JsonSchemaAssertions`のスキーマ定数3個 | `ReservationSystemDsl`のprivate定数だった`AVAILABLE_TIME_SLOT_SCHEMA`/`AVAILABILITY_RESPONSE_SCHEMA`/`PROBLEM_RESPONSE_SCHEMA`を、値を変えずに`JsonSchemaAssertions`のpublicフィールドへ移設しただけ。参照元(`assertReservationRejected`・`assertAvailableSlotsAre`)の呼び出し方も定数名の参照先が変わっただけで、検証ロジック自体は無変更 | ✅ 移設前後で値の完全一致を確認。機能変更なし |

### 不一致・疑義

なし。⚠️に該当する行は検出しなかった。

### 機械検証（ADR-0007充足の実機確認）

SUTは停止中のためL4実行はdry-runまでだが、`RoomRulesDsl`が導入したOpenAPIスキーマ照合の実効性はSUTに依存しない部分のため、スタンドアロンJavaプログラムで直接検証した（Gradleの`acceptanceTestRuntimeClasspath`を用い、作業ディレクトリを`projects/reservation-system`に設定）。

1. `OpenApiInteractionValidator.createFor("contracts/reservation-api.yaml").build()` はGradleのデフォルト作業ディレクトリ（`projects/reservation-system`）から実行した場合に例外なく成功する（パス解決・yamlパースとも正常）
2. `RoomRulesResponse`の必須フィールドを全て含む正しい応答ボディ → `hasErrors=false`
3. 必須フィールド`capacity`を欠いた応答ボディ → `hasErrors=true`、`missing required properties ["capacity"]`を検出
4. 仕様にない余分なフィールド`extraField`を含む応答ボディ → `hasErrors=true`、`properties which are not allowed by the schema ["extraField"]`を検出

3・4により、ADR-0007が求める「フィールドの過不足…は照合器が守る」がRSV-Rの成功応答について実際に機能することを、コードのコメントを信じるのではなく実行結果で確認した。

さらに`./gradlew.bat acceptanceTest -Dcucumber.execution.dry-run=true --rerun-tasks`（JAVA_HOME=Corretto 23）を実行し、`BUILD SUCCESSFUL`・JUnit XML上`tests="29" skipped="0" failures="0" errors="0"`を確認した（29件は既存26件+RSV-R-01/02/03の3件が加算された数と一致）。`checkstyleAcceptanceTest`も`BUILD SUCCESSFUL`（`ReservationSystemDsl.java`は398行、`checkstyle.xml`のFileLength上限400行に収まっている。`RoomRulesDsl.java`への分割の妥当性を行数で直接確認した）。

## 2. レビューチェックリスト（verification.md L4詳細(3)）

| 観点 | 結果 | 指摘 |
|---|---|---|
| 過不足（文の通りのことをしているか） | OK | 新規4 step（R1〜R4）＋既存再利用1 step（R5）はいずれも文の指示通りの操作・検証のみを行い、文にない副作用はない。`checkRoomRules`は成否判定をThen側に委ねる設計（`checkAvailability`と同型）で一貫している。ただし`assertBusinessHours`/`assertCapacity`/`assertMinReservationDuration`はそれぞれ独立にステータス+スキーマ全体の再検証を行っており、1シナリオ(RSV-R-01)あたり同じ検証を3回実行している。結果への影響はないが無駄がある（4節） |
| Givenの正当性（実装をなぞっていないか） | OK | RSV-R用の新規Given stepは無い。RSV-R-01〜03のGivenは全てRSV-C/RSV-A承認済みの既存step`会議室が存在する`（Background）をそのまま再利用しており、公開境界(seam)経由。DB直接操作なし |
| Thenの検証対象（業務上の結果か） | OK | `assertBusinessHours`/`assertCapacity`/`assertMinReservationDuration`はいずれも公開API応答のフィールド値のみを検証しており、実装内部（DB行の中身等）には触れていない。RSV-R-02「最小予約時間はどの会議室でも共通」という業務ルールも、異なる会議室に対して同じ値が返ることをThen検証（2シナリオ分の期待値一致）で間接的に確認する設計であり妥当 |
| 失敗の握りつぶし（空catch・緩い比較・sleep） | OK | try/catch・sleep・リトライなし。`checkRoomRules`はステータス判定をせず記憶のみ行い、Then側が厳密に検証する設計（既存パターンと同型）。スキーマ照合の失敗は`assertThat(report.hasErrors()).isFalse()`で確実に失敗として顕在化する（実機検証で確認済み、上記参照） |
| 暗黙の前提（マジックナンバーの明文化） | OK | 新規の数値・文字列定数は導入されていない（R1のroom ID解決ロジックは既存`NONEXISTENT_ROOM_ID_PREFIX`の再利用）。RSV-R-01の「最小予約時間30分」はシナリオ本文に明示された値であり、DSL側にマジックナンバーとして埋め込まれてはいない |

## 3. 契約↔テスト対応の監査

- **step未実装の承認済みシナリオ**: なし。`./gradlew.bat acceptanceTest -Dcucumber.execution.dry-run=true --rerun-tasks`で機械突き合わせを実施し、`BUILD SUCCESSFUL`、JUnit XML上`tests="29" skipped="0" failures="0" errors="0"`を確認した（前回RSV-A監査時点26件+RSV-R 3件=29件と一致）。RSV-R-01〜03の3シナリオ全てが未定義ステップなしで解決されている
- **シナリオに対応しない孤児step**: なし。新規step定義4個（予約ルールを確認する／営業時間が返る／定員が返る／最小予約時間が返る）は全て`reservation-rules.feature`内に対応する文言を確認した。既存step`予約ルールの確認は拒否される`が呼ぶ`assertReservationRejected`も含め、新規公開DSLメソッド（`checkRoomRules`、`assertBusinessHours`、`assertCapacity`、`assertMinReservationDuration`）は全て対応するstepから呼ばれている
- **同義stepの重複疑い**: なし。「予約ルールの確認は"◯◯"という理由で拒否される」は既存の「予約は"◯◯"という理由で拒否される」（RSV-C/K）「空き枠の確認は"◯◯"という理由で拒否される」（RSV-A）とGherkin文言が異なり業務上の対象（予約ルール確認 vs 予約操作 vs 空き枠確認）も異なるが、拒否理由コードの体系（`REJECTION_BY_REASON`＋`ProblemResponse`スキーマ）が共通のためDSL実装（`assertReservationRejected`）を意図的に再利用している。RSV-A監査時と同じ判断基準で、主語（文の対象）が違う以上、別のGherkin表現として存在すること自体は妥当であり重複ではない
- **契約`reservation-api.yaml`の`RoomRulesResponse`スキーマとの一致確認**: 本スライスでは`JsonSchemaAssertions`への手動転記を行わず、契約ファイル原本を`OpenApiInteractionValidator`で直接読み込んで照合する方式を採用している。これにより「手動転記とyaml定義の乖離」というRSV-A監査で指摘したリスクの構造そのものが、RSV-Rの成功応答については解消されている（上記「機械検証」参照）

## 4. 申し送り注記（次スライスの契約起草時にarchitectが確認する。meta/adr/0009）

**RSV-A監査（audit-rsv-a.md）からの申し送りの状況**:
- 4節「ADR-0007の適用範囲が部分的」＋activeContext宿題(a)「スキーマ照合が契約yamlの手写しになっている二重管理リスク」: **部分的に解消**。本差分はbuild.gradleにOpenAPI検証ライブラリ(`swagger-request-validator-restassured`)を追加し、RSV-Rの成功応答（`RoomRulesResponse`）については契約yaml原本を直接読んで照合する方式に切り替えた。これにより新規に追加された検証は手動転記を伴わない。ただし、RSV-A監査時点で既に存在していた`JsonSchemaAssertions`（`AvailabilityResponse`／`AvailableTimeSlot`／`ProblemResponse`の手動転記スキーマ）は本差分でも移行されておらず、そのまま使われ続けている（`assertReservationRejected`・`assertAvailableSlotsAre`が対象。RSV-Rの拒否応答検証R5もこの手動転記版を経由する）。二重管理構造そのものは、新規追加分については解消されたが、既存分については残存している。次スライスでこれらも契約原本直読み方式へ揃えるかどうかの判断が必要
- activeContext宿題(b)「スキーマ照合が予約作成・キャンセルの成功応答に未適用」: **未解消・継続**。`assertReservationCreated`／`assertReservationCancelled`は本差分でも変更されておらず、スキーマ機械照合を一切呼んでいないことをコードで確認した（フィールドの手動列挙比較のみ）
- 4節「`ReservationCreateSteps`クラス名が内容を正確に表さない」: **悪化して継続**。RSV-C→RSV-C+RSV-K→RSV-C+RSV-K+RSV-A→RSV-C+RSV-K+RSV-A+RSV-Rと、4スライス分のstepが同一クラス（140行）に積み上がった。javadocは「必要ならDIモジュール追加をorchestratorにエスカレーション」と明記しているが、まだ実施されていない。5スライス目が来る前の判断を推奨する
- 4節「JSONスキーマの手動転記という構造」: 上記宿題(a)と同一論点として扱った（部分解消）

**本監査（RSV-R）で新たに見つかった申し送り事項**:
- **build.gradleの変更主体が確認できない**: 本差分には`swagger-request-validator-restassured`依存の追加が含まれるが、`build.gradle`冒頭のコメント（「developer/testerは原則ここを変更しない…testerは変更せずエスカレーション」）およびactiveContext.mdの宿題(a)（「orchestratorがbuild.gradleに…依存を追加し」という想定）と照らすと、この追加が想定された手順（orchestrator経由）で行われたのか、tester自身が変更したのかが本監査の独立性の制約（コミット履歴・testerの説明を参照しない）上判断できない。機能面は実機検証で正しく動作することを確認済みだが、手順面の確認は人間に委ねる
- **RSV-R専用の`checkRoomRules`が`checkAvailability`と同一のroom ID解決ロジックを複製している**: 両者とも「`roomIdByName`から引き、無ければ`does-not-exist-room-`+ランダムUUID」という同じ組み立てを別々に持つ。動作は正しいが、今後「会議室1件を指定して確認する」系のクエリスライスが増えるたびにこの複製が増える可能性がある。共通ヘルパーへの抽出を将来検討してよい
- **`RoomRulesDsl`の3つのassertがそれぞれ独立にステータス+スキーマ全体を再検証している**: RSV-R-01/02はThen+And+Andの3ステップから成り、`assertBusinessHours`・`assertCapacity`・`assertMinReservationDuration`がそれぞれ`assertResponseValid()`（ステータス200判定+スキーマ機械照合）を呼ぶため、1シナリオあたり同じ検証が3回実行される。結果は正しいが冗長。将来的にThen句の検証対象がさらに増える場合は、一度だけ検証してから複数の値チェックを行う構造への整理を検討してよい

## 5. 結論

- [x] 承認材料が揃った（人間の突き合わせ待ち）
- [ ] testerへ差し戻し（不一致あり）
- [ ] シナリオ側の欠陥疑い → 矛盾分析レポートを提出済み

新規・変更された4つのstep定義（RSV-R-01〜03を担う`checkRoomRules`／`assertBusinessHours`／`assertCapacity`／`assertMinReservationDuration`）と、既存メソッド`assertReservationRejected`の再利用（RSV-R-03）は、いずれもシナリオ本文が言っている通りの操作・検証のみを行っており、過不足・実装依存・失敗の握りつぶしは検出されなかった。RSV-Rで新規導入されたOpenAPI契約原本直読み方式のスキーマ照合は、過不足検知が実際に機能することをスタンドアロン実行で確認した（コメントを信じるのではなく実行結果で検証）。契約↔テスト対応（dry-run全29シナリオ・未定義ステップ0件・孤児step無し・重複疑い無し）も機械的に確認できた。差し戻しレベルの不一致は無いと判断する。

人間承認時に認識されたい点（いずれも非ブロッキング、詳細は4節）:
- build.gradleへの依存追加が、想定された手順（orchestrator経由）で行われたかをreviewerの独立性の制約上確認できていない
- ADR-0007のスキーマ機械照合はRSV-Rの成功応答には新方式（契約原本直読み）で適用されたが、既存のRSV-A空き枠確認・全拒否応答は旧方式（手動転記）のまま、予約作成・キャンセルの成功応答は依然未適用
- `ReservationCreateSteps`クラスの命名と責務の乖離が4スライス目にしてさらに拡大している（RSV-A監査からの継続課題）
