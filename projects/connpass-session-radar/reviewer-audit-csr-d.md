# 監査レポート: CSR-D daily digest acceptance translation

- 作成: reviewer
- 監査対象: `acceptance/steps/daily-digest.steps.mjs`、`acceptance/dsl/daily-digest.mjs`、`acceptance/run-l4.mjs`、および実行先 bridge / acceptance support / pipeline
- 方法: steps/DSL/runner を先に読み、承認済み `contracts/daily-digest.feature` と `contracts/daily-digest-test-support.yaml` に照合した。`tester-response-csr-d.md` は確認対象の位置特定にのみ用い、正しさの根拠にはしていない。
- 検証実行: reviewer はゲートを実行していない。依頼で L0--L4 が緑とされたが、本レポートは静的な翻訳監査であり、その結果を再主張するものではない。

## 0. 承認者向けサマリ

**結論: testerへ差し戻し（CSR-D-04のThen 1点）。** CSR-D-01 の残席目安は数値であること、CSR-D-07 の commit済みYAML論理入力は revision・形式・commit状態まで、受け入れ runner が確認するようになった。CSR-D-04 は、承認済み test-support が指定する `FETCH_FAILURE` のみで十分であり、一覧作り失敗を別途注入できないことは契約の曖昧さではない。

残る不一致は、CSR-D-04 の「非公開設定や内部事情を含まない」が L4 では `safeFailureSummary` が文字列であることに縮約されている点である。実装が現在安全な固定文を返すこととは別に、step/DSLがその業務上の制約を失わせている。

| シナリオ | テストが実際にやること（平易な文） | 一致 |
|---|---|---|
| CSR-D-01 | 条件に合う合成イベントを配信し、一覧が1通で、イベントの基本項目と数値の残席目安があることを確かめる。 | ✅ |
| CSR-D-02 | 条件に合わない合成イベントが一覧に無いことを確かめる。 | ✅ |
| CSR-D-03 | 該当なしを表す空の通知が1通届くことを確かめる。 | ✅ |
| CSR-D-04 | 取得失敗の合成結果で、失敗を表す空の通知が1通届き、要約が文字列であることを確かめる。 | ⚠️ 要約の安全性を確かめない。 |
| CSR-D-05 | 通常申込とconnpass外申込が一覧にあり、前者に残席目安、後者に残席欄なしの区分があることを確かめる。 | ✅ |
| CSR-D-06 | 有効イベントは一覧にあり、中止イベントは無いことを確かめる。 | ✅ |
| CSR-D-07 | commit済みYAMLとして表された改訂条件を確認し、新条件だけに合うイベントがあり旧条件だけのイベントが無いことを確かめる。 | ✅ |
| CSR-D-08 | 定員なしイベントが「定員なし」と示されることを確かめる。 | ✅ |
| CSR-D-09 | 残席ゼロと補欠ありのイベントがどちらも満席と示されることを確かめる。 | ✅ |
| CSR-D-10 | 期間内イベントはあり、期間後イベントは無いことを確かめる。 | ✅ |

---

## 1. 対訳表（技術詳細）

| シナリオ文 | このコードが実際に行うこと | シナリオとの一致 |
|---|---|---|
| Background: 興味の条件がYAMLに書かれている | `sourceFormat=yaml` を持つ承認済みの論理条件入力を用いる。実ファイルを読むのではなく、approved seam が定める入力表現を検証する。 | ✅ |
| Background: 通知先が設定されている | acceptance-only の受信者向け捕捉器を作り、通知先に伝わる内容を返す。 | ✅ |
| CSR-D-01 Then | 1通の digest、対象イベントの存在と基本項目、`remaining-estimate`、整数の `remainingSeats` を確認する。 | ✅ |
| CSR-D-02 Then | `nonmatching-event` が受信者向け events に無いことを確認する。 | ✅ |
| CSR-D-03 Then | `no-matching-events`、空の events、1通の通知を確認する。 | ✅ |
| CSR-D-04 Then | `FETCH_FAILURE` から `failure`、空の events、1通の通知、文字列の `safeFailureSummary` を確認する。 | ⚠️ 文字列の内容が安全であることを確認しない。 |
| CSR-D-05 Then | 同じ捕捉一覧内で通常申込が `remaining-estimate`、外部申込が `omitted-for-advertisement` であることを確認する。 | ✅ |
| CSR-D-06 Then | 有効イベントの存在と中止イベントの不在を確認する。 | ✅ |
| CSR-D-07 Given / Then | `sourceFormat=yaml`、`committed=true`、`revisionRef=revised-conditions`、非空 profile を確認したうえで、改訂条件の正負の結果を確認する。 | ✅ |
| CSR-D-08 Then | 対象イベントの capacity kind が `unlimited` であることを確認する。 | ✅ |
| CSR-D-09 Then | 残席ゼロ・補欠ありの各イベントの capacity kind が `full` であることを確認する。 | ✅ |
| CSR-D-10 Then | 期間内イベントの存在と期間後イベントの不在を確認する。 | ✅ |

### CSR-D-04の境界判断

`FixtureEventSource.mode` は CSR-D-04 に `FETCH_FAILURE` だけを定め、`fixtures.fetch-failure` も同じシナリオを `expectedNotification: failure` に対応付けている。さらに `AcceptanceRunInput.fixtureRef` の許容値には一覧作り失敗を表す値が無い。これは受け入れ実行が観測すべき失敗出力を、取得失敗の代表入力で固定した承認済みの seam である。

したがって、一覧作り失敗の別入力をこの L4 翻訳に追加しないことは不足でも契約矛盾でもない。別の失敗経路の内部的分岐を増やすには、先に test-support 契約の再承認が必要である。

### 不一致・疑義

1. **CSR-D-04: 安全な失敗要約の未検証。** `assertSafeFailure` は `safeFailureSummary` の型だけを確認する。承認済み契約は APIキー・通知先secret・非公開設定値・スタックトレース・生の外部エラーを含めないと定めるため、任意の文字列を許す現行stepはThenを完全には翻訳していない。`FETCH_FAILURE` の範囲は十分だが、同fixtureが与える失敗情報を利用した安全な要約の意味検証は必要である。

## 2. レビューチェックリスト（verification.md L4詳細(3)）

| 観点 | 結果 | 指摘 |
|---|---|---|
| 過不足 | NG | CSR-D-04 の通知要約の安全性が文字列型へ省略されている。その他は approved seam の範囲で一致する。 |
| Givenの正当性 | OK | 承認済みの合成fixture・commit済み条件論理表現・受信者向け捕捉を使用し、DBやSUT内部状態を直接操作しない。 |
| Thenの検証対象 | NG | 受信者に伝わる通知を観測する点は適切だが、CSR-D-04 の安全性という業務上の結果を検証していない。 |
| 失敗の握りつぶし | OK | step/DSL に空catch、sleep、retry、条件分岐、成功の代替経路は無い。 |
| 暗黙の前提 | OK | CSR-D-07 の条件表現は approved test-support contract が明示する。CSR-D-04 の安全性は同契約で明示されるが、stepが使っていない。 |

## 3. 契約↔テスト対応の監査

- step未実装の承認済みシナリオ: **なし**。CSR-D-01..CSR-D-10 は runner と DSL fixture map に1対1で存在する。
- シナリオに対応しない孤児step: **なし**。公開された9 step は少なくとも1つの runner ケースで使われる。
- 同義stepの重複疑い: **なし**。`eventIsVisible` は存在・基本項目、`eventHasCapacity` は存在・基本項目と指定されたcapacity区分、`remainingSeatEstimateIsNumeric` は残席目安の数値をそれぞれ別に確認する。
- approved seam 上の未対応: **なし**。ただし CSR-D-04 Then の上記内容検証不足が残る。

## 4. 申し送り注記

- `RecipientVisibleEvent` の日時・主催・場所の一部は nullable である。外部データ欠損時にCSR-D-01の「示される」をどう扱うかは、このスライスで追加判断を要する矛盾とは断定できないため、将来の契約起草時に確認する。

## 5. 結論

- [ ] 承認材料が揃った（人間の突き合わせ待ち）
- [x] testerへ差し戻し（CSR-D-04の安全な失敗要約の検証が必要）
- [ ] シナリオ側の欠陥疑い → 矛盾分析レポートを提出済み
