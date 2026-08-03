# 監査レポート: RSV-T「会議室を登録できる」

- 作成: reviewer
- 監査対象: `git diff project/reservation-system...feat/reservation-system-room-registration`（契約が承認された時点=`project/reservation-system`からの新規・変更分のみ）
  - `steps/RoomRegistrationSteps.java`（新規）
  - `dsl/RoomRegistrationDsl.java`（新規）
  - `dsl/RoomListDsl.java`（変更。既存メソッド`assertRoomIncluded`に1行追加＝メソッド冒頭で`listRooms()`を呼ぶように変更。他は無変更）
  - `contracts/reservation-room-registration.feature`（`@pending-implementation`タグの除去のみ。シナリオ本文は無変更であることを差分で確認済み）
- 突き合わせた契約: `contracts/reservation-room-registration.feature`（RSV-T-01〜04）、`contracts/reservation-api.yaml`のRSV-T追記部分（`POST /rooms`・`RoomRegistrationRequest`・`RoomSummary`再利用・`ROOM_NAME_DUPLICATE`/`INVALID_BUSINESS_HOURS`）。既存step再利用の確認に`contracts/reservation-rooms.feature`（RSV-L）、seam仕様の確認に`test-support-api.yaml`も参照
- 注意: 本レポートはtesterの意図説明・コード中のjavadoc・コミットメッセージを判断材料にせず、コードの動作のみから作成した（agents.md 3節、PRINCIPLES.md）。実装コード（`src/main`、`src/test`）・`design.md`も参照していない
- 前回監査: `reviews/audit-rsv-r.md`（RSV-R、承認済み）。**RSV-Lはreviewerが起動されないままマージされており、`reviews/audit-rsv-l.md`は存在しない**（activeContext.md記載の既知の規程逸脱）。したがって本レポートは、今回変更された1行だけでなく、**`RoomListDsl.java`の内容全体が初めて独立監査の対象になる**という点に留意されたい（4節参照）

---

## 0. 承認者向けサマリ（人間はまずここだけ読む）

**結論**: 承認材料が揃った。ただし3点、承認前に人間が目を通すべき論点がある（詳細は本節末尾と4節）

**平易版対訳表**（1行1step、業務の言葉のみ）

| シナリオの文 | テストが実際にやること | 一致 |
|---|---|---|
| 管理者が会議室"◯◯"を登録する(営業時間は"HH:MM"から"HH:MM"、定員はN人) | 指定した名前・営業時間・定員で、会議室登録の窓口（業務API）に登録を申し込み、応答を記録する。成否の判断はしない | ✅ |
| 会議室は登録される | 直前の申し込みが受理され、返ってきた会議室の情報（名前・営業時間・定員）が申し込み内容と一致し、会議室を識別するIDが割り振られていることを確かめる | ✅ |
| 会議室の登録は「理由」という理由で拒否される | 直前の申し込みが、指定した理由に対応する形（重複なら「既に同名あり」、営業時間の不整合なら「営業時間が不正」）で拒否されたことを確かめる | ✅ |
| （Given、既存stepの再利用）会議室"◯◯"が存在する(...) | RSV-C以降から再利用。試験専用の下ごしらえ窓口で会議室を用意する（同名なら上書き） | ✅ |
| （Then、既存stepの再利用・内部実装が変更）"◯◯"については営業時間...定員...であることが一覧に含まれる | RSV-Lから再利用。**この呼び出し自身が会議室の一覧を取り直したうえで**、指定した会議室が一覧に含まれ、営業時間・定員が一致することを確かめる | ✅（後述、要確認） |

**要確認の注記**（いずれも非ブロッキング、詳細は4節）:
1. `RoomListDsl.assertRoomIncluded`への1行追加は、承認済みのRSV-L-01（既存シナリオ）にも影響する共有DSLの変更である。機能的には問題ないと判断したが、RSV-L-01の検証の「厳密さの性質」がわずかに変わっている（同一スナップショットの一括検証→複数回の再取得による検証）。詳細は1節T5・4節
2. `contracts/reservation-api.yaml`のRSV-T追記ヘッダが、いまだ「改訂(承認待ち: ドラフト)」という記述のまま残っている。一方`.feature`ファイルは「ステータス: 承認済み(2026-08-01)」に更新済みで、govlint(L0)も本契約を「承認待ちの契約」として報告していない（実機確認済み、4節）。yaml側のコメントは機械検証の対象外であり実害はないが、記述として古いままなので次スライスの契約起草時に直すことを推奨する
3. RSV-Lは reviewer 監査を経ずにマージされている。本レポートは今回の1行差分に加え`RoomListDsl.java`全体を初めて独立監査したが、**RSV-L固有の他のメソッド（一覧の並び順検証・0件検証等）はこれまで一度も人間承認の材料として提示されていない**（4節）

---
以下は監査の証跡。承認者は原則サマリだけで判断できる。疑わしい行があれば該当の詳細に潜る。

## 1. 対訳表（技術詳細）

新規・変更されたstep/DSLのみ。「実際に行うこと」はシナリオを見る前にコードから書き起こした。

| # | シナリオ文 / 対象 | このコードが実際に行うこと | シナリオとの一致 |
|---|---|---|---|
| T1 | When 管理者が会議室"◯◯"を登録する(営業時間は"HH:MM"から"HH:MM"、定員はN人) | `RoomRegistrationDsl.registerRoom`: 引数をそのままJSON化し（`{"name":..,"businessHoursStart":..,"businessHoursEnd":..,"capacity":..}`）、`POST /rooms`（業務API、Given専用seamの`POST /test-support/rooms`とは別エンドポイント）へ送信し応答を記憶する。成否判定はここでは行わない | ✅ |
| T2 | Then 会議室は登録される | `RoomRegistrationDsl.assertRoomRegistered`: (1)応答ステータス201を検証、(2)契約`reservation-api.yaml`原本を`OpenApiInteractionValidator`でパースし応答スキーマ（`RoomSummary`）に機械照合、(3)`roomId`が空文字でないこと、(4)`name`/`businessHoursStart`/`businessHoursEnd`/`capacity`がリクエストした値とそれぞれ一致することを検証する | ✅ |
| T3 | Then 会議室の登録は"◯◯"という理由で拒否される | `RoomRegistrationDsl.assertRegistrationRejected`: 理由文言→(HTTPステータス,理由コード)の対応表`REJECTION_BY_REASON`（"同じ名前の会議室が既に存在する"→409/ROOM_NAME_DUPLICATE、"営業時間の終了時刻は開始時刻より後でなければならない"→422/INVALID_BUSINESS_HOURS）を引き、無ければ即失敗。あれば(1)ステータス一致、(2)応答スキーマ(`ProblemResponse`)の機械照合、(3)`code`一致、(4)`message`が非空、を検証する | ✅ 契約`reservation-api.yaml`のRSV-T追記「拒否理由コードとシナリオの対応表」と完全一致（キー文言・ステータス・コードとも） |
| T4 | Given 会議室"◯◯"が存在する(...)（RSV-T-02が使用。既存step、無変更） | `ReservationCreateSteps`定義済みの`会議室が存在する`をそのまま再利用（Cucumberは文言でグローバルにstepを解決するため、RSV-T専用の新クラスからも既存stepが自動的に使われる）。`ReservationSystemDsl.ensureRoomExists`が`POST /test-support/rooms`（Given専用seam、同名は上書き）で会議室を用意する | ✅ 業務API(`POST /rooms`)は使わず、意図的にGiven専用seamを使っている（契約解釈ポイント(8)と一致） |
| T5 | And "◯◯"については営業時間"HH:MM"から"HH:MM"、定員N人であることが一覧に含まれる（RSV-T-01が使用。既存step、内部実装が変更） | `ReservationCreateSteps.営業時間と定員が一覧に含まれる` → `ReservationSystemDsl.assertRoomIncludedInList` → `RoomListDsl.assertRoomIncluded`。**変更後**のこのメソッドは、呼び出されるたびに自分自身で`listRooms()`（`GET /rooms`）を実行し直してから、応答が200＋スキーマ適合であること、指定した会議室名が一覧に含まれること、その要素の営業時間・定員が期待値と一致することを検証する | ✅ RSV-T-01は独立した「一覧を確認する」Whenを持たないため、この段でメソッド自身が一覧を取得する必要がある。CucumberはGherkin文言でstepを一意解決するため、RSV-T専用の新しい別Thenを同一文言で追加することはできない（曖昧一致エラーになる）。したがって共有DSLの側で自己解決させる以外の実装選択肢は無かったと判断できる |
| T6（新規クラス） | `RoomRegistrationDsl` | RSV-T専用の協働クラス。静的フィールドで`OpenApiInteractionValidator.createFor("contracts/reservation-api.yaml").build()`を1回だけ生成し、成功(201)・拒否(409/422)の両方の応答検証で使い回す。`JsonSchemaAssertions`（手写しスキーマ）への新規追加は無い | ✅ RoomRulesDsl/RoomListDslと同方式。契約(ADR-0007)が求める機械照合が新規追加分について一貫して適用されている |

### 不一致・疑義

**⚠️（差し戻しレベルの不一致）: なし。**

以下は人間承認時に認識すべき注記（判断根拠付きで「許容」と判定した）:

- **注記A（T5、RSV-L-01への影響）**: `RoomListDsl.assertRoomIncluded`は変更前、呼び出し前に別のstep（`予約者が会議室の一覧を確認する`）が取得した応答をそのまま検証していた。変更後は自分で`GET /rooms`を取り直す。RSV-L-01のシナリオでは`Then 会議室の一覧は2件返り...`（`assertRoomListOrder`、変更なし・以前からの応答をそのまま使う）の後に`And "A"については...一覧に含まれる`・`And "B"については...一覧に含まれる`（`assertRoomIncluded`、変更後・都度再取得）が続く。GET自体は状態を変えない操作であり、両会議室の間で会議室一覧が変化する操作は挟まれていないため、再取得しても検証結果は変わらない。ただし検証の性質は変わっている: 変更前は「1回のGET応答が、順序・A/Bそれぞれの内容を同時に満たす」ことを検証していたのに対し、変更後は「（A用に取り直した）GET応答がAの内容を満たす」「（B用に取り直した）GET応答がBの内容を満たす」という、別々のスナップショットに対する検証に分解されている。今回のテスト環境（並行更新なし・GETは冪等）ではこの違いが実害を生む可能性は無いと判断したが、単一スナップショットの一貫性を検証する強さはわずかに弱まっている
- **注記B（T5、代替設計の余地）**: 呼び出し元を`ReservationSystemDsl.assertRoomIncludedInList`側で自己取得させる、あるいは`RoomListDsl.assertRoomIncluded`側で自己取得させる、のいずれでも影響範囲（RSV-L-01への波及）は変わらない（どちらも同じ共有経路を通るため）。tester側で「毎回取得済みか」を判定して分岐する設計にしなかったのは妥当——step定義・DSLへの分岐禁止の精神（verification.md L4詳細(1)）に照らせば、無条件の自己取得（冪等な操作なので分岐の必要が無い）の方が単純で検証しやすい
- **注記C（T3、拒否理由の文言とHTTP応答messageの非対応）**: `REJECTION_BY_REASON`のキー（シナリオの拒否理由文言）と、実際のHTTP応答`message`フィールドの中身は突き合わせていない（`message`は非空であることのみ検証）。これは既存の`ReservationSystemDsl.assertReservationRejected`（RSV-C以降）と同一の設計であり、契約が要求する検証の粒度（`code`で判定、自由文`message`は人間可読性のみ要求）と一致する。新規の逸脱ではない

## 2. レビューチェックリスト（verification.md L4詳細(3)）

| 観点 | 結果 | 指摘 |
|---|---|---|
| 過不足（文の通りのことをしているか） | OK | T1〜T3はいずれも文が指示する操作・検証のみを行い、文にない副作用はない。T2の`roomId`非空検証は文言には無いが、契約の解釈ポイント(1)「roomIdはサーバ採番」を裏付ける検証であり、スキーマ機械照合だけでは検出できない不備（空文字ID）を捕まえるための正当な追加である。既存パターン（RSV-Lのroom ID一致検証）とも整合する |
| Givenの正当性（実装をなぞっていないか） | OK | RSV-T-02のGivenは既存の`会議室が存在する`（Given専用seam、公開境界経由）をそのまま再利用しており、DB直接操作なし。**登録の重複判定という業務ルールを検証するために、業務API自身ではなくGiven専用seamで前提の会議室を作る**という設計は、契約の解釈ポイント(8)が明示的に許容している区分けと一致しており「通すための恣意的な準備」ではない |
| Thenの検証対象（業務上の結果か） | OK | T2・T3・T5はいずれも公開API応答（`POST /rooms`の直接応答、または`GET /rooms`の応答）のフィールド値のみを検証しており、DB等の内部構造には触れていない。T5（`assertRoomIncluded`の変更）は「Thenが自らGETを行う」という技術的な変化を伴うが、検証対象は変わらず公開境界越しの業務結果のままであり、実装の内部をなぞる方向への変化ではない。ただし前述の注記Aの通り、検証の厳密さの性質（単一スナップショット一貫性→都度再取得）が変わった点は、この観点の範囲内で人間に申し送る |
| 失敗の握りつぶし（空catch・緩い比較・sleep） | OK | try/catch・sleep・リトライなし。`assertRegistrationRejected`は対応表に無い理由文言なら`assertThat(expected).isNotNull()`で即座に失敗させ、握りつぶさない。スキーマ機械照合の失敗は`assertThat(report.hasErrors()).isFalse()`で確実に顕在化する |
| 暗黙の前提（マジックナンバーの明文化） | OK | 新規のマジックナンバー・暗黙の仮定は検出されなかった。拒否理由の対応表(`REJECTION_BY_REASON`)のキー文言は契約`reservation-api.yaml`のRSV-T追記の対応表と1文字単位で一致することを確認済み（1節T3）。T5の「Thenが自らGETを行う」という挙動は、契約側にそれを明示する記述は無い（できない——シナリオ本文は技術詳細を書かない規約のため）が、RSV-T-01のシナリオ構造（一覧確認のWhenが無い）から必然的に要求される挙動であり、恣意的な暗黙の仮定ではないと判断した |

## 3. 契約↔テスト対応の監査

- **step未実装の承認済みシナリオ**: なし。`./gradlew.bat acceptanceTest -Dcucumber.execution.dry-run=true --rerun-tasks`（`JAVA_HOME`をAmazon Corretto 23に設定して実行）を実施し、`BUILD SUCCESSFUL`、JUnit XML上`tests="35" skipped="0" failures="0" errors="0"`を確認した。RSV-R監査時点の29件（RSV-C/K/A/R）+RSV-L 2件+RSV-T 4件=35件と一致する。RSV-T-01〜04の4シナリオすべてが未定義ステップ・曖昧一致なしで解決されている
- **シナリオに対応しない孤児step**: なし。新規step定義3個（登録する／登録される／登録は拒否される）は全て`reservation-room-registration.feature`内に対応する文言を確認した。`RoomRegistrationDsl`の公開メソッド（`registerRoom`／`assertRoomRegistered`／`assertRegistrationRejected`）は全て対応するstepから呼ばれている
- **同義stepの重複疑い**: なし。「会議室の登録は"◯◯"という理由で拒否される」は既存の「予約は"◯◯"という理由で拒否される」（RSV-C/K）「空き枠の確認は"◯◯"という理由で拒否される」（RSV-A）「予約ルールの確認は"◯◯"という理由で拒否される」（RSV-R）とGherkin文言・主語（会議室の登録 vs 予約操作 vs 空き枠確認 vs 予約ルール確認）が異なり、対象とする業務操作も異なる。実装（`REJECTION_BY_REASON`+`ExpectedRejection`という構造）は既存パターンを踏襲しているが、各DSLクラスが独立した応答（`lastResponse`）を持つため実装の共有はしていない。主語が違う以上、別のGherkin表現として存在すること自体は妥当であり重複ではない（RSV-R監査時と同じ判断基準）
- **既存stepの再利用漏れ疑い**: なし。RSV-T-01のThen「一覧に含まれる」は新規stepを作らず既存stepを再利用しており（1節T5）、これが本スライスで最も再利用が難しい箇所だったと考えられるが、正しく再利用されている
- **govlint(L0)確認**: `python meta/tools/govlint.py`を実行し、エラー0件を確認した（実機確認）。「承認待ちのまま残っている契約」のREPORTにRSV-T(`reservation-room-registration.feature`)は含まれておらず、承認済み契約として扱われている（RFE-A・RFE-Bのみが該当、いずれも既知の宿題）
- **checkstyle(acceptanceTest)確認**: `./gradlew.bat checkstyleAcceptanceTest`を実行し`BUILD SUCCESSFUL`を確認した。`RoomListDsl.java`（127行）・`RoomRegistrationDsl.java`（103行）・`RoomRegistrationSteps.java`（40行）はいずれもcheckstyleのFileLength上限（400行）に十分収まっている

## 4. 申し送り注記（次スライスの契約起草時にarchitectが確認する。meta/adr/0009）

**RSV-R監査（audit-rsv-r.md）からの申し送りの状況**:
- 「ADR-0007の適用範囲が部分的」: RSV-Tの新規追加分（成功・拒否両方）は契約原本直読み方式で一貫している（1節T6）。既存のRSV-A空き枠確認・拒否応答全般（`JsonSchemaAssertions`の手写しスキーマ）は本差分でも移行されていない。二重管理の解消は新規追加分のみで、既存分は引き続き残存
- 「予約作成・キャンセルの成功応答にスキーマ機械照合が未適用」: 本差分の対象外であり未解消のまま継続
- 「`ReservationCreateSteps`クラス名が内容を正確に表さない」: 本スライスでは**新規クラス`RoomRegistrationSteps`を切り出す**ことでこれ以上の肥大を避けた（`ReservationCreateSteps`自体はRSV-T分の追加を受けていない）。切り出しの根拠（RSV-Tの登録操作はRSV-C以降が共有する`roomIdByName`状態を必要としない）はコード上も裏付けられる——`RoomRegistrationSteps`・`RoomRegistrationDsl`はいずれも`ReservationSystemDsl`のインスタンスにもroomIdByNameにも一切依存していないことを確認した。妥当な判断と評価する

**本監査（RSV-T）で新たに見つかった申し送り事項**:
- **RSV-Lはreviewer監査を経ずにマージされていた**: 本レポートの冒頭に記載の通り、`reviews/audit-rsv-l.md`は存在しない。今回`RoomListDsl.java`を読む過程で、RSV-L固有の既存メソッド（`assertRoomListOrder`・`assertNoElementHasMinReservationDuration`・`assertRoomListEmpty`・`resetAllRooms`・`listRooms`）にも目を通したが、明らかな不備は見当たらなかった。ただし本レポートはRSV-Tとの関連（`assertRoomIncluded`への影響）を目的とした確認であり、**RSV-L全体を正式な監査対象として対訳表・チェックリストを作成したものではない**。RSV-L分の後追い監査を行うかどうかは、activeContext.mdが記す通り人間判断が必要な既存の宿題である
- **`reservation-api.yaml`のRSV-T追記ヘッダが「承認待ち: ドラフト」のまま**: `.feature`ファイル側は`40f2d0b`で「承認済み(2026-08-01)」に更新されたが、同時にyaml側のコメントヘッダ（「改訂(承認待ち: ドラフト) 2026-08-01」という行、および各解釈ポイント冒頭の「承認待ち: ドラフト」表記）は更新されなかった。govlintのADR-0043検査は`.feature`ファイルのみを対象とするため機械的には検出されない（実機確認済み、3節）。実害はないが、契約の記述として古い状態のまま残っているため、次にこのyamlへ手を入れる際に是正することを推奨する
- **T5の検証の厳密さがわずかに弱まった件（注記A参照）**: 実害は無いと判断したが、将来「一覧取得と会議室登録の間に別の操作を挟む」ようなシナリオが追加された場合、`assertRoomIncluded`の自己取得的な性質（呼び出し時点の最新状態を毎回取り直す）が、意図と異なる結果を生む可能性がある。現時点のシナリオ群では問題にならないが、DSLのjavadocに書かれた理由づけを鵜呑みにせず、将来のシナリオ追加時に改めて確認されたい

## 5. 結論

- [x] 承認材料が揃った（人間の突き合わせ待ち）
- [ ] testerへ差し戻し（不一致あり）
- [ ] シナリオ側の欠陥疑い → 矛盾分析レポートを提出済み

新規3step（`RoomRegistrationSteps`、RSV-T-01〜04を担う）と、既存step2個の再利用（`会議室が存在する`＝無変更の再利用、`...一覧に含まれる`＝内部実装が変更された再利用）は、いずれもシナリオ本文が言っている通りの操作・検証のみを行っており、過不足・実装依存・失敗の握りつぶしは検出されなかった。スキーマ機械照合（ADR-0007）は成功・拒否の両応答に契約原本直読み方式で一貫して適用されている。契約↔テスト対応（dry-run全35シナリオ・未定義ステップ0件・孤児step無し・重複疑い無し、govlint実機確認でエラー0・本契約は承認済み扱い）も機械的に確認できた。差し戻しレベルの不一致は無いと判断する。

人間承認時に認識されたい点（いずれも非ブロッキング、詳細は0節・4節）:
- `RoomListDsl.assertRoomIncluded`への1行追加は、承認済みのRSV-L-01にも影響する共有DSLの変更であり、検証の厳密さの性質がわずかに変わっている（実害無しと判断したが人間の確認を推奨）
- `reservation-api.yaml`のRSV-T追記ヘッダに「承認待ち: ドラフト」という古い記述が残っている（機械検証の対象外、実害なし）
- RSV-Lはreviewer監査を経ずにマージされており、`RoomListDsl.java`のRSV-L固有部分は今回が初めての（正式ではない）目視確認だった
