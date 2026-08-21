# 監査レポート: CSR-D daily digest acceptance translation

- 作成: reviewer
- 監査対象: `acceptance/steps/daily-digest.steps.mjs`、`acceptance/dsl/daily-digest.mjs`、`acceptance/run-l4.mjs`、及び実行先の acceptance bridge / support / pipeline
- 照合先: 承認済み `contracts/daily-digest.feature` と v0.3 `contracts/daily-digest-test-support.yaml`
- 方法: code first で実際の操作と検証を読み取り、その後に契約へ照合した。tester/developerの説明、コメント、履歴は正しさの根拠にしていない。
- 検証実行: reviewer は実行していない。依頼時点で L0--L4 は緑と報告されているが、本監査は静的な翻訳監査であり、その結果を再主張するものではない。

## 0. 承認者向けサマリ

**結論: 承認材料が揃った（人間のstep実装承認待ち）。** CSR-D-01..10 は全て承認済み fixture と1対1で実行され、受信者向けの観測値を確認する。CSR-D-04 は取得失敗時に正確な approved synthetic private canary を内部例外へ載せ、その値が受信者向け failure summary に現れないことを検証する。

| シナリオ | テストが実際にやること（平易な文） | 一致 |
|---|---|---|
| CSR-D-01 | 条件に合うイベントを配信し、一覧が1通で、基本項目と数値の残席目安があることを確かめる。 | ✅ |
| CSR-D-02 | 条件に合わないイベントが一覧に無いことを確かめる。 | ✅ |
| CSR-D-03 | 該当なしを表す空の通知が1通届くことを確かめる。 | ✅ |
| CSR-D-04 | synthetic private canary を含む取得失敗で、失敗通知が1通届き、そのcanaryが受信者向け要約に無いことを確かめる。 | ✅ |
| CSR-D-05 | 通常申込とconnpass外申込が一覧にあり、前者に残席目安、後者に残席欄なしの区分があることを確かめる。 | ✅ |
| CSR-D-06 | 有効イベントは一覧にあり、中止イベントは無いことを確かめる。 | ✅ |
| CSR-D-07 | commit済みYAMLとして表された改訂条件を確認し、新条件だけに合うイベントがあり旧条件だけのイベントが無いことを確かめる。 | ✅ |
| CSR-D-08 | 定員なしイベントが定員なしとして示されることを確かめる。 | ✅ |
| CSR-D-09 | 残席ゼロと補欠ありのイベントがどちらも満席として示されることを確かめる。 | ✅ |
| CSR-D-10 | 期間内イベントはあり、期間後イベントは無いことを確かめる。 | ✅ |

**要確認の注記**: なし。v0.3 canary は実在の秘密ではなく、`FETCH_FAILURE` 専用の承認済み合成値である。

---

## 1. 対訳表（技術詳細）

| シナリオ文 | このコードが実際に行うこと | シナリオとの一致 |
|---|---|---|
| Background: 興味の条件がYAMLに書かれている | approved seam の `sourceFormat=yaml` を持つ commit済み条件論理入力を使用する。 | ✅ |
| Background: 通知先が設定されている | acceptance-only の受信者向け捕捉器を作り、通知先に伝わる内容を観測する。 | ✅ |
| CSR-D-01 Then | 1通の digest、対象イベントの基本項目、`remaining-estimate` と整数の `remainingSeats` を確認する。 | ✅ |
| CSR-D-02 Then | `nonmatching-event` が受信者向け events に存在しないことを確認する。 | ✅ |
| CSR-D-03 Then | `no-matching-events`、空の events、1通の通知を確認する。 | ✅ |
| CSR-D-04 Given / Then | `fetch-failure` fixture は exact canary を含む例外を投げる。runner は同じ exact canary を failure step に渡し、`failure`、空の events、1通の通知、要約文字列、そして要約にcanaryが無いことを確認する。 | ✅ |
| CSR-D-05 Then | 同じ捕捉一覧内で通常申込が `remaining-estimate`、外部申込が `omitted-for-advertisement` であることを確認する。 | ✅ |
| CSR-D-06 Then | 有効イベントの存在と中止イベントの不在を確認する。 | ✅ |
| CSR-D-07 Given / Then | `sourceFormat=yaml`、`committed=true`、`revisionRef=revised-conditions`、非空 profiles を確認したうえで、改訂条件の正負の結果を確認する。 | ✅ |
| CSR-D-08 Then | 対象イベントの capacity kind が `unlimited` であることを確認する。 | ✅ |
| CSR-D-09 Then | 残席ゼロ・補欠ありの各イベントの capacity kind が `full` であることを確認する。 | ✅ |
| CSR-D-10 Then | 期間内イベントの存在と期間後イベントの不在を確認する。 | ✅ |

### CSR-D-04 canary の経路

承認済み v0.3 contract の `fixtures.fetch-failure.fetchFailureCanaryExpectation` は、内部例外値と受信者向け要約に含めてはならない値を同じ固定文字列に定める。`createFixtureEventSource` は `fetch-failure` 時だけその文字列を含む例外を投げる。pipeline は failed digest を作り、capture はその failure summary を受信者向け値として保持する。L4 runner は DSL の同一文字列を `failureWasDelivered` に渡し、`assertSafeFailure` が summary に含まれないことを検証する。従って、内部入力と外部観測の両方が exact approved canary に結び付く。

`FETCH_FAILURE` のみをこの受け入れ seam で扱うことも v0.3 の明示的な範囲である。別の一覧作り失敗を追加しないことに契約矛盾はない。

### 不一致・疑義

なし。

## 2. レビューチェックリスト（verification.md L4詳細(3)）

| 観点 | 結果 | 指摘 |
|---|---|---|
| 過不足 | OK | 各シナリオの入力・結果は approved fixture と recipient-visible capture に対応する。CSR-D-04 はexact canaryも検証する。 |
| Givenの正当性 | OK | 承認済みの合成fixture、commit済み条件論理表現、受信者向け捕捉を使い、DBやSUTの内部状態を直接準備しない。 |
| Thenの検証対象 | OK | 内部の中間値ではなく、通知回数・種別・受信者に伝わるイベント・安全な失敗要約を観測する。 |
| 失敗の握りつぶし | OK | step/DSLに空catch、sleep、retry、条件分岐、緩い成功代替は無い。 |
| 暗黙の前提 | OK | fixture ID、条件revision、canary値はいずれも承認済み test-support contract が明示する。 |

## 3. 契約↔テスト対応の監査

- step未実装の承認済みシナリオ: **なし**。CSR-D-01..CSR-D-10 は runner と DSL fixture map に1対1で存在する。
- シナリオに対応しない孤児step: **なし**。公開された9 step は少なくとも1つの runner ケースで使われる。
- 同義stepの重複疑い: **なし**。イベント存在、capacity区分、数値の残席目安、commit済みYAML、失敗通知はそれぞれ異なる検証対象を持つ。
- contract外の独自入力・観測: **なし**。CSR-D-04 canary は v0.3 contract の exact value と期待に一致する。

## 4. 申し送り注記

なし。

## 5. 結論

- [x] 承認材料が揃った（人間の突き合わせ待ち）
- [ ] testerへ差し戻し（不一致あり）
- [ ] シナリオ側の欠陥疑い → 矛盾分析レポートを提出済み
