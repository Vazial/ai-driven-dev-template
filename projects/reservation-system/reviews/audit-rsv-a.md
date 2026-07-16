# 監査レポート: RSV-A「空き枠を確認できる」

> **人間承認の記録（orchestrator追記）: 承認 2026-07-16**。承認材料は本レポートの「0. 承認者向けサマリ」（平易版対訳表5行）。
> 要確認注記3件は非ブロッキングとして承認され、次スライスの宿題とする（activeContext参照）。

- 作成: reviewer
- 監査対象: `git diff origin/main -- projects/reservation-system/src/acceptanceTest/`（RSV-K承認時点=originmainからの新規・変更分のみ）
  - `dsl/JsonSchemaAssertions.java`（新規）
  - `dsl/ReservationSystemDsl.java`（変更。RSV-C/RSV-K分は無変更、RSV-A分を追加。ただし`assertReservationRejected`は既存メソッドへの追記変更あり＝下記参照）
  - `steps/ReservationCreateSteps.java`（変更。RSV-C/RSV-K分のstep本体は無変更、javadocとRSV-A分のstep追加のみ）
- 突き合わせた契約: `contracts/reservation-availability.feature`（RSV-A-01〜07）、`contracts/reservation-api.yaml`のRSV-A追記部分、`contracts/test-support-api.yaml`（seam仕様、ADR-0008原文）。既存step再利用の確認に`reservation-create.feature`・`reservation-cancel.feature`も参照
- 注意: 本レポートはtesterの意図説明・コミットメッセージを参照せず、コードのみから作成した（agents.md 3節）。実装コード（src/main、src/test）・design.mdも参照していない
- 前回監査: `reviews/audit-rsv-k.md`（RSV-K、承認済み）。申し送り注記の解消/発火状況は「4. 申し送り注記」参照

---

## 0. 承認者向けサマリ（人間はまずここだけ読む）

**結論**: 承認材料が揃った

**平易版対訳表**（1行1step、業務の言葉のみ）

| シナリオの文 | テストが実際にやること | 一致 |
|---|---|---|
| 予約者が"会議室A"の空き枠を確認する | 指定した会議室・当日について、空き状況をシステムに問い合わせる。会議室が用意されていなければ、実在しないIDで問い合わせて「見つからない」応答を引き出す | ✅ |
| 空いている時間帯として"HH:MM"から"HH:MM"が返る | 応答が成功で、空いている時間帯がちょうど1件、指定した開始・終了時刻と一致することを確かめる | ✅ |
| 空いている時間帯として"HH:MM"から"HH:MM"と"HH:MM"から"HH:MM"が返る | 応答が成功で、空いている時間帯がちょうど2件、指定した順序・内容で一致することを確かめる | ✅ |
| 空いている時間帯は一つもない | 応答が成功で、空いている時間帯が0件であることを確かめる | ✅ |
| 空き枠の確認は"◯◯"という理由で拒否される | 応答が指定の理由（例:「会議室が存在しない」→404）で拒否されたことを確かめる。予約作成・キャンセルの拒否確認と同じ仕組みを共用している | ✅ |

**要確認の注記**:
- 応答の「フィールドの過不足」を機械的に確認する仕組み（ADR-0007対応）が今回新たに導入されたが、これは「予約が作成された」「予約がキャンセルされた」の成功応答にはまだ適用されておらず、「空き枠確認の成功応答」と「拒否応答全般（作成・キャンセル・空き枠確認すべてに影響）」にのみ適用されている。ADR-0007の理念上は全成功応答に広げるのが筋だが、本差分の範囲外（詳細は1節・4節）
- 空き枠確認のstep・検証ロジックが元々「予約作成」専用だったクラス（`ReservationCreateSteps`）にさらに積み増しされた。クラス名が実態を表さない状態が3スライス目にして拡大している（RSV-K監査からの継続課題、詳細は4節）

---
以下は監査の証跡。承認者は原則サマリだけで判断できる。疑わしい行があれば該当の詳細に潜る。

## 1. 対訳表（技術詳細）

新規・変更されたstepのみ。「実際に行うこと」はシナリオを見る前にコードから書き起こした。

| # | シナリオ文 / 対象 | このコードが実際に行うこと | シナリオとの一致 |
|---|---|---|---|
| A1 | When 予約者が"◯◯"の空き枠を確認する | `roomIdByName`（Backgroundの`会議室が存在する`が積んだ会議室名→ID）から名前を引き、見つかれば実IDを、見つからなければ`does-not-exist-room-`+ランダムUUIDを使って`GET /rooms/{roomId}/availability?date=2026-07-14`（固定日付）を呼ぶ。問い合わせたIDを`lastAvailabilityRoomId`に記憶する。成否判定はしない | ✅ RSV-A-07「存在しない会議室」はGivenで作られないため`roomIdByName`に無く、自動的に実在しないIDで問い合わせる設計。`reservationIdFor`（RSV-K承認済み）と同型のフォールバック |
| A2 | Then 空いている時間帯として"HH:MM"から"HH:MM"が返る | 応答200であること、応答ボディが`AvailabilityResponse`スキーマ（roomId/date/availableSlots、過不足なし・型一致）に適合すること、`roomId`が問い合わせたID、`date`が固定日付と一致すること、`availableSlots`の(startTime,endTime)の並びが指定した1件ちょうどと**順序含め**一致することを検証する | ✅ |
| A3 | Then 空いている時間帯として"HH:MM"から"HH:MM"と"HH:MM"から"HH:MM"が返る | A2と同じ検証ロジックを、期待値2件（指定順）で呼ぶ | ✅ 契約`reservation-api.yaml`の解釈ポイント(5)「availableSlotsは開始時刻昇順」と、順序を検証する実装が整合 |
| A4 | Then 空いている時間帯は一つもない | A2と同じ検証ロジックを、期待値0件（空リスト）で呼ぶ | ✅ |
| A5 | Then 空き枠の確認は"◯◯"という理由で拒否される | 既存の拒否理由対応表（`REJECTION_BY_REASON`。今回"会議室が存在しない"→(404, ROOM_NOT_FOUND)を1行追加）を引き、ステータス・`ProblemResponse`スキーマ適合・`code`・`message`非空を検証する`assertReservationRejected`をそのまま呼ぶ（RSV-C/RSV-K既存メソッドの**再利用**） | ✅ 追加された対応表エントリはreservation-api.yamlのROOM_NOT_FOUND/404追記と一致 |
| A6（既存メソッド変更） | `assertReservationRejected`本体 | ステータス検証の直後に`JsonSchemaAssertions.assertMatchesSchema`（`ProblemResponse`スキーマ: code/message、過不足チェック込み）を追加した。この変更はRSV-C/RSV-K/RSV-A全ての拒否シナリオに影響する（下記2節・4節で詳述） | ✅ 検証を厳密化する方向の変更で、既存シナリオを緩める変更ではない。ADR-0007の遡及適用として妥当 |
| A7（新規インフラ） | `JsonSchemaAssertions`クラス | `reservation-api.yaml`の`AvailabilityResponse`/`AvailableTimeSlot`/`ProblemResponse`スキーマをJavaの定数として手動で写し取り、応答ボディの「フィールドの過不足」と「型」を機械照合する汎用ヘルパー。実際のyamlファイルをパースしているわけではない | ✅（機能としては正しく動作。yamlとの同期は手動維持である点は4節で申し送り） |

### 不一致・疑義

なし。⚠️に該当する行は検出しなかった。

## 2. レビューチェックリスト（verification.md L4詳細(3)）

| 観点 | 結果 | 指摘 |
|---|---|---|
| 過不足（文の通りのことをしているか） | OK | 新規5 step（A1〜A5）はいずれも文の指示通りの操作・検証のみを行い、文にない副作用はない。`checkAvailability`は成否判定をThen側に委ねる設計（`reserve`/`cancelReservation`と同型）で一貫している |
| Givenの正当性（実装をなぞっていないか） | OK | RSV-A用の新規Given stepは無い。RSV-A-02〜06のGivenはRSV-C/RSV-K承認済みの既存step（`予約が存在する`／`予約者の予約が存在する`／`予約をキャンセルしている`）をそのまま再利用しており、公開API経由。DB直接操作なし |
| Thenの検証対象（業務上の結果か） | OK | `assertAvailableSlotsAre`は公開API応答のroomId・date・availableSlots（開始・終了時刻の並び）のみを検証しており、実装内部（DB行数など）には触れていない。RSV-A-05（最小予約時間未満の隙間除外、ADR-0006）は「隙間を含まない2件ちょうど」という期待値との一致で間接的に検証されており、業務ルールの検証として妥当 |
| 失敗の握りつぶし（空catch・緩い比較・sleep） | OK | try/catch・sleep・リトライなし。`checkAvailability`はステータス判定をせず記憶のみ行い、Then側が厳密に検証する設計（既存パターンと同型） |
| 暗黙の前提（マジックナンバーの明文化） | OK（一部注記） | `NONEXISTENT_ROOM_ID_PREFIX`は名前で自己文書化、コメントでRSV-A-07・`reservationIdFor`との対応も明記されている。一方、`JsonSchemaAssertions`のスキーマ定数（`AVAILABILITY_RESPONSE_SCHEMA`等）は`reservation-api.yaml`の内容を**手動で転記**したものであり、契約ファイルの変更時にこの転記が追随しなければ静かに乖離しうる暗黙の前提がある。現時点では転記内容と契約定義を照合し完全一致を確認した（3節参照）が、この構造自体は4節で申し送る |

## 3. 契約↔テスト対応の監査

- **step未実装の承認済みシナリオ**: なし。`./gradlew.bat acceptanceTest -Dcucumber.execution.dry-run=true`（JAVA_HOME=Corretto 23、`--rerun-tasks`でキャッシュを無効化して再実行）で機械突き合わせを実施し、`BUILD SUCCESSFUL`、JUnit XML上`tests="26" skipped="0" failures="0" errors="0"`を確認した。26件はRSV-C 10件+RSV-K 9件+RSV-A 7件の合計と一致。RSV-A-01〜07の7シナリオ全てがテストケースとして検出され（`grep`でテスト名を確認）、未定義ステップは0件
- **シナリオに対応しない孤児step**: なし。新規step定義5個（空き枠を確認する／空いている時間帯が一件返る／空いている時間帯が二件返る／空いている時間帯は一つもない／空き枠の確認は拒否される）は全て`reservation-availability.feature`内に対応する文言を確認した。新規DSL公開メソッド（`checkAvailability`、`assertAvailableSlots`×2、`assertNoAvailableSlots`）は全て対応するstepから呼ばれている
- **同義stepの重複疑い**: なし。「空き枠の確認は"◯◯"という理由で拒否される」（RSV-A）は既存の「予約は"◯◯"という理由で拒否される」（RSV-C/K）とGherkin文言が異なり業務上の対象（空き枠確認 vs 予約操作）も異なるが、拒否理由コードの体系（`REJECTION_BY_REASON`＋`ProblemResponse`スキーマ）が共通のためDSL実装（`assertReservationRejected`）を意図的に再利用している。文言の主語が違う以上、別のGherkin表現として存在すること自体は妥当であり、重複ではなく正当な再利用と判断する
- **契約`reservation-api.yaml`のスキーマとJavaの手動転記との一致確認**: `AvailabilityResponse`(required: roomId, date, availableSlots) / `AvailableTimeSlot`(required: startTime, endTime) / `ProblemResponse`(required: code, message)の3スキーマについて、yaml定義とJava定数(`AVAILABILITY_RESPONSE_SCHEMA`等)のフィールド名・型を1件ずつ突き合わせ、全て一致することを確認した（優先的にproperties=requiredであるため過不足チェックのロジックとも整合）

## 4. 申し送り注記（次スライスの契約起草時にarchitectが確認する。meta/adr/0009）

**RSV-K監査（audit-rsv-k.md）からの申し送りの状況**:
- 4.(a)「clock固定フックがRSV-C既存シナリオへ与える影響」: 本差分では`@Before`フック自体は無変更（javadocコメントのみRSV-A言及を追加）。未解消のまま持ち越し。今回のRSV-A追加でも新たな時刻依存ルールはシナリオ上見当たらないため、リスクの性質は変化していない
- 4.(c)「`ReservationCreateSteps`クラス名が内容を正確に表さない」: **悪化して継続**。RSV-C→RSV-C+RSV-K→RSV-C+RSV-K+RSV-Aと、3スライス分のstepが同一クラスに積み上がった。javadocはCucumberのDefaultObjectFactory制約を理由に明記しており技術的に妥当だが、スライスが増えるたびにこの1クラスへの集約が続く設計になっている。次にスライスが追加される前に、DIモジュール導入（javadoc記載の「必要ならorchestratorへエスカレーション」）を検討する適切なタイミングだと考える
- 6.3「`attendeeCount`期待値のハードコードがGivenの不変条件に依存」: 本差分では`cancelReservation`/`CancelRequest`関連のコードに変更なし。トリガーされていない。引き続き有効な注記として次スライスへ持ち越し

**本監査（RSV-A）で新たに見つかった申し送り事項**:
- **ADR-0007の適用範囲が部分的**: 本差分で`JsonSchemaAssertions`による機械照合が導入されたのは「拒否応答全般」（`assertReservationRejected`、既存メソッドへの追記のためRSV-C/RSV-K/RSV-A全ての拒否シナリオに遡及適用）と「空き枠確認の成功応答」（新規）の2つ。一方、「予約作成の成功応答」(`assertReservationCreated`)と「予約キャンセルの成功応答」(`assertReservationCancelled`)は今回のdiffで触れられておらず、引き続き手動でのフィールド列挙による検証のままである。ADR-0007の文言「L4のThen検証（成功・拒否とも）は…標準とする」を額面通り読むと、これら2箇所も次のスライスで機械照合に揃えるのが筋。verification.md L4詳細(2)により本diffの範囲外の既存コードへの差し戻しはできないため、次スライスのtester作業の候補として明記する
- **JSONスキーマの手動転記という構造**: `JsonSchemaAssertions`は実際の`reservation-api.yaml`をパースするのではなく、スキーマ定義をJavaの定数として手で複製する設計。javadoc自身が「依存追加が必要な範囲まで要件が育った場合はエスカレーション対象」と認めている通り、契約ファイルとJava定数の二重管理という構造は、ADR-0008が公開APIとseam仕様について避けようとした「散文の言い換えによる劣化」と類似のリスク（今回は散文ではなく手動転記だが、ソースオブトゥルースが2箇所に分裂する点は同型）を内包する。現時点は一致を人手（本監査）で確認したが、スキーマの数が増えるほど照合コストが増える。将来、契約ファイル自体を読み込んで検証する仕組み（例: yaml中の`components.schemas`を実行時にロードする）への切り替えを検討候補として記録する
- **`assertAvailableSlots`が固定引数（1件用・2件用）のオーバーロードである**: 現行の承認済みシナリオ(RSV-A-01〜07)は最大2件の空き枠しか要求しないため実用上問題はないが、将来3件以上の空き枠を検証するシナリオが追加された場合はこの2メソッドでは表現できず、可変長引数またはリストベースのAPIへの変更が必要になる。次のクエリ系スライスの設計時に考慮されたい

## 5. 結論

- [x] 承認材料が揃った（人間の突き合わせ待ち）
- [ ] testerへ差し戻し（不一致あり）
- [ ] シナリオ側の欠陥疑い → 矛盾分析レポートを提出済み

新規・変更された5つのstep定義（RSV-A-01〜07を担う`checkAvailability`／`assertAvailableSlots`×2／`assertNoAvailableSlots`／`assertReservationRejected`の再利用）は、いずれもシナリオ本文が言っている通りの操作・検証のみを行っており、過不足・実装依存・失敗の握りつぶしは検出されなかった。既存メソッド`assertReservationRejected`への機械スキーマ照合の追加はADR-0007の遡及適用として妥当で、検証を緩めるのではなく厳密化する変更だった。契約↔テスト対応（dry-run全26シナリオ・未定義ステップ0件・孤児step無し・重複疑い無し）も機械的に確認できた。差し戻しレベルの不一致は無いと判断する。

人間承認時に認識されたい点（いずれも非ブロッキング、詳細は4節）:
- ADR-0007のスキーマ機械照合が「予約作成」「予約キャンセル」の成功応答にはまだ適用されていない（次スライスへの持ち越し候補）
- `JsonSchemaAssertions`のスキーマ定義はyamlからの手動転記であり、契約ファイルとの二重管理リスクを内包する
- `ReservationCreateSteps`クラスの命名と責務の乖離が3スライス目にして拡大している（RSV-K監査からの継続課題）
