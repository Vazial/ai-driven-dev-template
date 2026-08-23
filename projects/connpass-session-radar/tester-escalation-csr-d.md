# 矛盾分析: CSR-D daily-digest L4 翻訳

## 結論

承認済みのCSR-D-01〜CSR-D-10をL4のstep定義とテストDSLへ翻訳するための、テスト専用の公開境界がまだ一意に定まらない。そのため、この時点で`steps/`・`dsl/`を追加すると、承認済み契約に無い実行ハーネス、YAML設定形式、通知の観測形式をtesterが選ぶことになる。これはP-08および`meta/verification.md`のL4詳細に反するため、step/DSLの起草を停止する。

## 衝突 1: CSR-D-07 と設定の差し替え境界

- シナリオ: `CSR-D-07`は、YAMLを変更してcommitした後の翌朝実行が変更後の条件だけを使うことを要求する。
- 制約: `daily-digest-contract.yaml`は、InterestConditionsの「正確なファイルパス・キー名の大文字小文字規約等」を定めない。`daily-digest-test-support.yaml`は取得源とNotifierCaptureだけを定め、設定の準備・変更・実行時刻の設定を受け取るseamを定めない。`FixtureEventSource.x-acceptance-scenarios`にも`CSR-D-07`は含まれない。
- 事象: Givenの「YAMLで変更され、commitされている」を公開テスト境界で再現し、Thenの旧条件だけに合うイベントの不在を決定的に観測するDSL関数を一意に定義できない。

### 案A

`daily-digest-test-support.yaml`に、受け入れテスト時だけ現在のInterestConditionsを指定・変更できる設定seamを追加し、CSR-D-07を対応シナリオとして明記する。

トレードオフ: テスト専用入力の型と、commit済み設定をどう表すかが新たな契約判断になる。

### 案B

InterestConditions YAMLの正確な保存場所・形式を業務契約として定め、受け入れテストはその公開設定ファイルを差し替える。

トレードオフ: 実装構成を契約へ早期に固定する。設定の詳細を実装選択から保留する現在の契約方針とは異なる。

## 衝突 2: recipient-visibleな通知とNotifierCaptureの観測値

- シナリオ: CSR-D-01、03、04、05、08、09は、利用者に「示される」「分かる」「含まれない」通知内容を要求する。
- 制約: `NotifierCapture`が捕捉するのはNotifierPortへ渡る`DailyDigest`である。一方、NotifierPortはDigestを配信先固有の表現へ変換して送信する境界であり、受信者に届く表現のスキーマまたはcaptureは契約化されていない。
- 事象: 例えば「定員が無い旨が示される」と`remainingSeatsKnown: false`かつ`remainingSeats: null`を同一視するか、実際の通知文に定員なしの表現があることまで検証するかを、testerが決めることになる。同様に失敗通知の安全性をどの受信者向け表現で検証するかも定まらない。

### 案A

テストsupport契約に、Notifierの受信者向け出力を捕捉するseamと、その最小の機械可読表現を追加する。

トレードオフ: LINE固有のペイロードを契約へ漏らさないよう、通知内容に必要な抽象だけを人間が選ぶ必要がある。

### 案B

受け入れ基準の「示される」を`DailyDigest`の構造化フィールドだけで満たす、と契約を明示する。

トレードオフ: 実際に届くLINE通知の可読表現はL4では保証されなくなる。product-briefの「読みやすさ」をどの段で保証するかを別途明確にする必要がある。

## 衝突 3: fixture modeと個別イベントの識別

- シナリオ: CSR-D-02、05、06、08、09、10は、特定のイベントが一覧に含まれる／含まれない、または特定の情報を持つことを検証する。
- 制約: `FixtureEventSource.mode`は各モードが持つ性質を説明するが、受け入れテストが参照できるイベント識別子、固定のタイトル、または期待集合を定めない。
- 事象: DSLが「そのイベント」を何で指すかを独自に命名すると、fixture adapterとテストの間に契約外の暗黙の結合が生じる。

### 案A

test-support契約の各fixture modeに、テストから参照可能な識別子と期待集合を定義する。

トレードオフ: fixtureデータの細部が契約に増える。

### 案B

テスト用のfixture catalogをtest-support契約から参照し、そのcatalogをmachine-readable SSoTにする。

トレードオフ: ファイルが増えるが、業務契約とテスト用データを分離できる。

## 推奨

案Aを軸に、architectがtest-support契約を補完してからtesterがL4を起草する。特にCSR-D-07の設定seam、recipient-visible通知の観測境界、fixture eventの識別を、契約として人間承認の対象にする。これは実装ハーネスの選択ではなく、承認済みシナリオを公開のテスト境界から再現・観測できる形へ完成させるための契約上の不足を解消する作業である。

## 検証状態

- 適用対象: L4受け入れテスト。
- 実行: 未実行。実行可能なsteps/DSLまたはL4ランナーが未定義であり、上記の契約上の境界不足を推測で補えない。
- 結果: 実行不能（失敗ではない）。
