# friction-log.md

> 追記専用。AIが迷った・誤った・曖昧な指示で事故った瞬間を**その場で**記録する（P-05）。
> 各エントリは「下の段への押し込み」（P-10）まで書けたら完了。テンプレート改善の一次データ。
>
> 様式（meta/adr/0012）: 見出しの直後に機械可読なメタデータ（```yaml ブロック）、その後にprose。
> **cause_key** は「どの具体的な欠落か」を示すkebab-caseのキー。**新しいFRを書く前に既存のcause_keyを見て、同じ原因なら同じキーを再利用すること**。
> 同一キーの2回目以降は `meta/tools/govlint.py` が構造的欠陥のシグナルとして報告する（判断は人間。lintは失敗させない）。

---

## FR-001: HANDOFF.mdが参照する既存素材（EventStorming・ADR8本・Gherkin）がリポジトリ内に無く、所在確認で作業が止まった

```yaml
id: FR-001
date: 2026-07-13
found_at: 人間
slice: プロジェクト開始
agents: [architect]
cause_category: 引き継ぎ文書の欠落
cause_key: handoff-external-material-location-missing
pushed_to: []
status: 未対応
principles: [P-05]
```

- 事象: HANDOFF.md 5節が「EventStorming・ADR8本・Gherkin素材が既存」と書くが所在パスの記載が無く、リポジトリ内検索でも見つからなかった。architectはアーキテクチャ選定を一般ドメイン知識で先に進め、人間がADR-0001承認後にワークサマリーを手動共有して評価を照合する流れになった
- 原因の仮説: 引き継ぎ文書の欠落 — 外部成果物を参照する時に所在（パス/URL）を書く規約が無い
- 押し込み先: templates/への追記候補 — HANDOFF系文書で外部素材に言及する場合は所在と取り込み状態（済/未）を必須にする。1件目なのでテンプレート変更はまだ提案せず、再発したら変更提案を出す（同原因2回で構造的欠陥のルール）
- 補足: 素材の全文取り込みも未了（ワーク側ADR 0001〜0008全文・.featureファイル2本）。実害は出ていない

---

## FR-002: 契約ドラフト（受け入れシナリオ11本・OpenAPI）が人間承認者にとって読みにくかった

```yaml
id: FR-002
date: 2026-07-13
found_at: 人間
slice: RSV-C
agents: [architect]
cause_category: 規程の欠落
cause_key: approval-artifact-readability-convention-missing
pushed_to: [meta/adr/0002-acceptance-scenario-template.md]
status: 対応済み
principles: [P-01]
```

- 事象: architectが承認依頼した契約ドラフトに、人間から「シナリオ11本が読みにくい」「OpenAPIは慣れていないと読みにくい」との指摘。シナリオを構造なしにフラットに11本並べ、API仕様に要約と具体例を添えていなかった
- 原因の仮説: 規程の欠落 — 「人間が短時間で承認できる契約の書き方」の規約がA層に無い。verification.mdはstep実装のレビュー容易性（4層分離・対訳表）は規定するが、その前段の契約自体の可読性は未規定
- 押し込み先: 契約の書き方規約の候補3点 — (1)シナリオは業務ルールでグルーピング (2)同型の拒否ケースはシナリオテンプレート+例表に畳む (3)API仕様の冒頭に要約と具体例を置く。今回は契約側を直して対処。A層テンプレート化は同種friction再発時に変更提案を出す（meta/変更はADR必須）

---

## FR-003: 契約ファイルのヘッダコメントが読者に伝わらなかった（「契約」「規約」「ID」等の項目名が不明瞭）

```yaml
id: FR-003
date: 2026-07-13
found_at: 人間
slice: RSV-C
agents: [architect]
cause_category: 規程の欠落
cause_key: approval-artifact-readability-convention-missing
pushed_to: [meta/adr/0002-acceptance-scenario-template.md]
status: 対応済み
principles: [P-04, P-05]
```

- 事象: FR-002の改善後も、人間からヘッダの項目名（「契約」「状態」「規約」「ID」）が直感的でないと指摘。特に「規約」行は書き手（agent）向けルールの繰り返しで、読者（承認者）には不要な情報だった（verification.mdに既にある内容の再掲＝P-04違反）。「# language: ja」が機械向け指定であることも説明が無かった
- 原因の仮説: 規程の欠落 — FR-002と同原因（契約の書き方規約がA層に無い）の2回目。ヘッダに「誰向けの情報か」の設計がなく、書き手向けメタ情報と読者向け情報が混在した
- 押し込み先: **同原因2回のため構造的欠陥。A層への変更提案を出す**: meta/templates/に受け入れシナリオの雛形（ヘッダ規約込み: 機械向け指定には説明を添える・ステータス表記・ID凡例・出典は各ルール直下・書き手向け規約は規程から繰り返さない）を追加する提案

---

## FR-004: ドメイン用語の変更（社員→予約者）をADRに記録せず進め、人間に指摘された

```yaml
id: FR-004
date: 2026-07-13
found_at: 人間
slice: RSV-C
agents: [architect]
cause_category: 規程の欠落
cause_key: adr-trigger-criteria-missing
pushed_to: [meta/adr/0003-adr-with-human-decisions.md]
status: 対応済み
principles: [P-06, P-01]
```

- 事象: 承認済み契約の「社員」を「予約者」へ一般化する際、人間の承認は取ったが、EventStormingのアクター定義からの逸脱というドメイン上の決定なのにADRを起票せず、契約テキストの修正だけで済ませた。人間の「ADRにしなくていいの？」の指摘で発覚し、事後にプロジェクトADR-0003を起票
- 原因の仮説: 規程の欠落 — 「何がADRを要する決定か」の判定基準が明文化されていない（architect定義は「契約のドラフト・整合性チェック」を言うが、承認済み決定からの逸脱・上書きにADRが要ることはP-06から推論するしかない）
- 押し込み先: 判定基準を規程に足す — 「承認済みの決定（ワーク素材・既存ADR・承認済み契約の設計判断）を変える/逸脱する変更は、大小を問わずADRを起票してから実施する」

---

## FR-005: architectが内部矛盾を含む契約を起草し、人間承認も通過してしまった（testerの翻訳段階で検知）

```yaml
id: FR-005
date: 2026-07-14
found_at: L4
slice: RSV-C
agents: [architect, tester]
cause_category: 検証の不足
cause_key: contract-schema-representability-unchecked
pushed_to: [meta/adr/0002-acceptance-scenario-template.md]
status: 対応済み
principles: [P-08, P-10]
```

- 事象: 日マタギ拒否のシナリオはAPIスキーマ（単一date+時刻2つ）で表現不能な入力を前提としており、時刻逆転のシナリオと観測上同一のリクエストに別の拒否コードを要求する矛盾があった。architectの整合性チェックも人間の契約承認もこれを見逃し、testerが翻訳不能に直面して初めて検知された
- 原因の仮説: 検証の不足 — 契約起草時に「各シナリオの入力と期待出力がAPIスキーマで表現可能か」を確かめる手順が無い。シナリオ（業務の言葉）とAPIスキーマ（機械の形）を別々に読むと矛盾が見えない
- 押し込み先: 雛形の記入コツに「全シナリオをリクエスト/レスポンスの具体値に落として表現可能性を確認する」を明記。なおtesterのエスカレーションプロトコル自体は設計通り機能した（推測で埋めず停止・報告した）
- 補足: 契約はプロジェクトADR-0004で改訂（当該シナリオを削除し欠番化）

---

## FR-006: seamインターフェースの仕様伝達ミスで、testerとdeveloperの成果物がL4実行時に噛み合わなかった（同原因2回目）

```yaml
id: FR-006
date: 2026-07-15
found_at: L4
slice: RSV-K
agents: [orchestrator, tester, developer]
cause_category: 伝達の構造
cause_key: orchestrator-as-substantive-source
pushed_to: [meta/adr/0008-test-infra-contract-file.md]
status: 対応済み
principles: [P-03, P-04]
```

- 事象: PUT /test-support/clock の日時形式が不一致（tester: オフセット付き、developer: LocalDateTime）で境界値シナリオ4本が400。原因はorchestratorがtesterへseam仕様を「{"now": "<ISO日時>"}」と曖昧に言い換えて伝えたこと（testerは遮断によりdesign.mdの正確な仕様例を読めない）
- 原因の仮説: 伝達の構造 — コンテキスト遮断された2つのagentが同じインターフェースの両側を作る時、仕様の「原文」を双方に渡す仕組みが無く、orchestratorの言い換えが劣化点になる。**RSV-CのroomId不一致（seam応答フィールド名）と同原因の2回目**（1回目はfriction-logに記録し損ねていた。これ自体も反省点であり、meta/adr/0012の動機になった）
- 押し込み先: **構造的欠陥として変更提案**: seam仕様をdesign.mdの節から独立した「テストインフラ契約」ファイル（リクエスト/レスポンス例つき）に切り出し、tester/developerの双方に原文のまま参照させる（言い換え禁止）
- 補足: 対応済み（DSL修正・L4全緑確認）。規程への押し込みも完了（meta/adr/0008 + contracts/test-support-api.yaml + verification.md追記）

---

## FR-007: 固定基準日（過去日）が時刻依存ルールと衝突し、現在時刻Givenの無いキャンセルシナリオが期限切れで全滅した

```yaml
id: FR-007
date: 2026-07-15
found_at: L4
slice: RSV-K
agents: [tester]
cause_category: L4インフラの非決定性
cause_key: l4-clock-nondeterminism
pushed_to: [meta/adr/0009-audit-note-followup.md]
status: 対応済み
principles: [P-10]
```

- 事象: DSLの基準日2026-07-14は実時刻から見て過去のため、clockを固定しないシナリオでは「開始15分前を過ぎている」が常に成立し422。RSV-Cでは過去予約が許可されているため顕在化せず、時刻依存ルール（キャンセル期限）の導入で初めて露出した
- 原因の仮説: L4インフラの非決定性 — デフォルトが実時刻のため、テスト結果が実行日時に依存する構造だった。**reviewerがRSV-C監査の注記Aで「固定日付は将来の日付ルール導入で壊れる」と予見していた事例が現実化**（予見は記録されたが、押し込み（対策）まで行われていなかった）
- 押し込み先: DSLのシナリオ開始フックで毎回clockを基準日の固定時刻に設定し、L4全体を決定論化。教訓の規程化として、監査の申し送り注記を次スライスの契約起草時に確認するルールを追加
- 補足: 対応済み（シナリオ開始フックでclockを基準日09:00に固定、L4決定論化・全緑確認）

---

## FR-008: 監査レポートが承認者の読める分量でなく、対訳表の平易化を人間に求められた

```yaml
id: FR-008
date: 2026-07-15
found_at: 人間
slice: RSV-K
agents: [reviewer]
cause_category: 規程の欠落
cause_key: approval-artifact-readability-convention-missing
pushed_to: [meta/adr/0010-audit-report-approver-summary.md]
status: 対応済み
principles: [P-01, P-05]
```

- 事象: RSV-Kの監査レポート（再監査記録込みで約200行）に対し、人間から「読める分量じゃない」「対訳表はもっと平易に」との指摘。orchestratorがチャットで平易版対訳表を作り直して承認を得た。監査の証跡としての網羅性と、承認者が読む要約が同じ文書で兼用されていた
- 原因の仮説: 規程の欠落 — FR-002/003（契約の可読性）と同型の「人間承認アーティファクトの可読性」問題が監査レポートでも発生。audit-report雛形に承認者向けサマリの区画が無い
- 押し込み先: audit-report雛形の冒頭に「承認者向けサマリ」節（結論1行・平易版対訳表: 専門用語/メソッド名/ファイル名なしの1行1step・要確認注記のみ）を必須化し、詳細な監査証跡は後続の節に分離する

---

## FR-009: orchestratorがarchitectのディスパッチ・プロンプトにドメイン/設計の実質指示をアドリブで注入した

```yaml
id: FR-009
date: 2026-07-16
found_at: 人間
slice: RSV-A
agents: [orchestrator, architect]
cause_category: 規程の欠落
cause_key: orchestrator-as-substantive-source
pushed_to: [meta/adr/0011-orchestrator-dispatch-routing-only.md]
status: 対応済み
principles: [P-04, P-01]
```

- 事象: RSV-Aの契約起草をarchitectにディスパッチする際、orchestratorがプロンプトに「読み取りモデルはイベントを生まない・べき等」「空き枠はキャンセル済みを除外する（部分排他の読み取り版）」といったドメイン・設計の実質的内容を書き込んだ。人間から「アドリブ指示は明文化されずルーチン化されない」と指摘
- 原因の仮説: 規程の欠落 — orchestrator自身の制約がどの規程にも明文化されていなかった。(a)プロンプトはその場限りで非バージョン管理（P-04違反）、(b)FR-006（seam仕様のorchestrator言い換え=劣化点）と同型、(c)architectに答えを渡すと「ソースから自力導出したか」の独立性が崩れる（tester/reviewer分離と同じ原理）
- 押し込み先: meta/agents.md 6節「orchestratorの制約」を新設（ディスパッチはroutingのみ・実質的内容の注入禁止）。初適用としてRSV-Aのarchitect起草を汚染ドラフト破棄→routingのみで再起草
- 補足: クリーン再起草の結果、architectは核心シナリオをソースだけから自力導出した。orchestratorの注入は何も足していなかったことが実証された

---

## FR-010: HANDOFF.mdが完了済みの「次のタスク」を持ち続け陳腐化していた（コールドスタート経路の破綻）

```yaml
id: FR-010
date: 2026-07-17
found_at: 人間
slice: 規程改善バッチ後
agents: [orchestrator]
cause_category: 揮発性状態の置き場の誤り
cause_key: volatile-state-in-static-doc
pushed_to: [meta/adr/0013-handoff-static-cold-start.md]
status: 対応済み
principles: [P-11]
```

- 事象: 人間から「別セッションにまたがってもちゃんと動くか確認したい」との問題提起。確認するとHANDOFF.md 5節「次のタスク」の5項目（リポジトリ初期構成〜friction-log運用開始）は全て完了済みで、フレッシュセッションがHANDOFFを読むと終わった仕事を指示される状態だった。4スライス+バッチ3本を1セッションで走らせてきたため、コールドスタート経路が一度も検証されず腐りに気づけなかった
- 原因の仮説: 揮発性状態の置き場の誤り — 「次に何をするか」という現在状態を、不変であるべきHANDOFF.mdに置いた（P-11違反）。さらに人間の「HANDOFFっているんだっけ」の問いで、揮発性状態を除いてもHANDOFFの大半が他文書の再掲（P-04違反）で同じくドリフトすると判明。加えてHANDOFF.mdが権限マトリクスに無く更新責任者が不在だった。テキスト修正では再発するため構造で直す必要がある
- 押し込み先: HANDOFF.mdを入口ポインタに削り、揮発性状態も内容の再掲も持たせない（読み始める順のみ持つ。ADR-0013）。permissions.mdにHANDOFF.mdの行を追加
- 補足: 単一セッションで完結させ続けたこと自体が、クロスセッション経路の未検証を招いた。実地検証は成果物抽出（B層）と結合させず、ルーティン化されたスライスをフレッシュセッションに拾わせる形で別途行う

---

## FR-011: 検証インフラ（CI・build・govlint・プローブ）に定義された所有者も検証経路も無く、orchestratorが場当たりで書き、WARNが4スライス見過ごされた

```yaml
id: FR-011
date: 2026-07-17
found_at: 人間
slice: 規程改善バッチ後
agents: [orchestrator]
cause_category: 責務・検証経路の欠落
cause_key: orchestrator-produces-artifact-directly
pushed_to: [meta/adr/0014-verification-infra-ownership.md]
status: 対応済み
principles: [P-01, P-10, P-04]
```

- 事象: 人間がL4のSUTログにWARN（`HttpMessageNotReadableException: Required request body is missing`）を発見。原因はorchestratorが書いたCIの死活監視がボディ無しPOSTで業務/seamエンドポイントを叩いていたこと。pass/failしか見ていなかったため4スライス見過ごされた。人間の「CIは誰が作って誰が直すのが責務なのか。フローに載せないと検証できない」との問いで、検証インフラ（CI・build.gradle・govlint・プローブ）が権限マトリクスに1つも無く、orchestratorが場当たりで書いて手で検証（自己採点）していたと判明
- 原因の仮説: 責務・検証経路の欠落 — 検証を回す仕掛けそのものの所有者と検証フローが未定義で、orchestratorにdefaultしていた。これは「orchestratorがrouting役を越えて実質的仕事をする」の**3回目**（FR-006: seam仕様の言い換え／FR-009: プロンプトへの答えの注入／本件: CIの実装代行）。**同族だが機構は異なる** — FR-006/009の cause_key `orchestrator-as-substantive-source` は「伝達経路への介入」、本件は「成果物の代行」。機械の3回目シグナルを鳴らすためにキーを寄せると機械検証を欺くことになるため、正直に別キー（`orchestrator-produces-artifact-directly`）とし、同族性はここと meta/adr/0014 のprose で繋ぐ。ADR-0011（注入の禁止）を一般則へ拡張する動機になった
- 押し込み先: 一般則「orchestratorは実質的成果物を作らない」＋検証ハーネス（ci.yml=orchestrator・自己検証／build.gradle・govlint=developer・テスト付き）の所有明示（ADR-0014）。**ログ清潔チェックをL4に追加**し、目視のWARN発見を機械へ（P-01/P-10）。プローブは存在しない部屋へのGET（404・WARN無し）に修正
- 補足: govlintに単体テストが無い（orchestratorの手作業検証の残骸）のもこのfrictionの一部。developerがテスト付きで持ち直す宿題

---

## FR-012: ルート直下の静的文書（README・activeContext）が揮発性の進捗を抱えて陳腐化していた（FR-010と同因の2回目）

```yaml
id: FR-012
date: 2026-07-18
found_at: AI
slice: B層パック抽出（ADR-0015）の副産物
agents: [orchestrator, architect]
cause_category: 揮発性状態の置き場の誤り
cause_key: volatile-state-in-static-doc
pushed_to: [README.md, meta/README.md]
status: 対応済み
principles: [P-11, P-04]
```

- 事象: B層パック抽出中に、architectがroot README.mdとroot activeContext.mdの陳腐化を圏外事項として指摘。README.mdは「状態」節に進捗（スライス2本・B層未着手・L1〜L4）を抱えて実態（4本・B層実体化・L0〜L4）とずれ、パックが載れば「B層は空」が嘘になる。root activeContext.md（7/13）は初日の孤児で、自分で「詳細はprojects側を見よ」と書きつつ一度も更新されず二重の状態文書として残っていた
- 原因の仮説: 揮発性状態の置き場の誤り — 静的な公開文書（README）に進捗を持たせた。これは**FR-010（HANDOFFが揮発性の「次のタスク」を抱えた）と同一原因の2回目**であり、cause_keyを正直に一致させた（機構が本当に同じなので寄せてよい。FR-011とは逆のケース）。ただし一般則は既にP-11「現在はactiveContextだけが持つ」として存在しており、これは新ルールの欠落でなく**施行漏れ**。root activeContextはC層（各プロジェクト）に置くとmeta/README.md 17行目で成文化済みのため、ルート孤児は削除が正しい
- 押し込み先: README.mdの「状態」節を削りactiveContext/friction-logへのポインタに（P-11の適用）。root activeContext.md孤児を削除。新ADRは立てない（P-11で足りる）。govlintは cause_key `volatile-state-in-static-doc` の2回目を報告する — 3回目が出たら「静的文書に進捗表現が混入していないか」の機械検査を投資する判断に進む（現時点はP-11の人手適用で足りる）

---

## FR-013: B層パックを実需要（N=1）の前に作った。P-02/P-05違反を、orchestratorがバックログ項目を premise 未検証のまま実行して起こした

```yaml
id: FR-013
date: 2026-07-18
found_at: 人間
slice: B層パック抽出（ADR-0015）の直後
agents: [orchestrator, architect]
cause_category: 予防的な作り込み（早すぎる抽象化）
cause_key: built-ahead-of-need
pushed_to: [meta/architecture-selection.md]
status: 対応済み
principles: [P-02, P-05]
```

- 事象: activeContextのバックログにあった「③ B層抽出」を、orchestratorが「そもそもこれ要るか」を問わずに実行し、architectを動かして `packs/domain-model-java-spring/` とADR-0015を作った。人間が「B層って必要？ テンプレにすべき？」と premise を問い、破棄に至った。スタックは reservation-system 1本のみ（N=1）で、パックは重複を1つも償却しておらず、しかも参照実装を"描写"する形（複製→ドリフト病、FR-010/012と同型）だった
- 原因の仮説: 予防的な作り込み — 2本目の同スタックプロジェクトが無い＝本物の重複が無いのに抽出した。典型的な「1アプリからのフレームワーク早すぎ抽出」。根本は、テンプレートの核である**P-02/P-05をorchestrator自身がバックログ項目に適用しなかった**こと。「リストに載っている」を実行理由にした。P-02チェック（本当に今要るか）を人間が代わりに行う結果になった
- 押し込み先: パックとADR-0015を破棄しB層を空に戻す。**B層の位置づけを「昇格で埋まる任意のカタログ」に再定義**（A→B一方向・型=A/実体=B・低儀式・マッチ制。architecture-selection.mdにarchitectが数行で明文化）。「実プロジェクトで(スタック×役割)が実証され2本目が欲しがった時に、汎用スケルトンとして昇格」を唯一の充填経路とし、書き溜めを禁ずる
- 補足: orchestratorはバックログ項目の着手前に「P-02: これは今必要か」を通す。ディスパッチ前の premise 検証はrouting役の責務に含む

---

## FR-014: シナリオIDが契約検証(L0)と実装検証(L4)を結合しており、「実装より先に受け入れシナリオだけを下書きする」状態を構造的に作れなかった

```yaml
id: FR-014
date: 2026-07-22
found_at: L4
slice: RSV-L
agents: [architect, tester]
cause_category: 検証レイヤーの構造的結合
cause_key: scenario-id-couples-l0-and-l4
pushed_to: []
status: 未対応
principles: [P-08, P-10]
```

- 事象: reservation-frontend側の設計↔契約整合性監査で見つかった未契約の必要性（`GET /rooms`、
  consumer-driven contract）を受け、architectがAPI仕様(`reservation-api.yaml`)と受け入れシナリオ
  (`reservation-rooms.feature`、RSV-L-01〜03)を一括でドラフトした。ところがシナリオを実装より先に
  置いた状態でCIを回すと、L4(Cucumber)が「定義されているシナリオにはステップ定義(実装)が要る」ため
  Undefined Stepで失敗した。回避しようと.featureを削除すると、今度はL0(govlint)が「参照している
  シナリオIDは.featureに定義必須」というルールに反し、reservation-api.yaml・test-support-api.yaml
  内のRSV-L-01/02/03参照が未定義として失敗した。**シナリオIDという同一の識別子が、契約側の参照整合
  (L0)と実装側のステップ網羅(L4)という別々の検証層を結合しており、「シナリオを実装より先に契約だけ
  下書きする」という中間状態が構造的に作れない**ことが判明した
- 原因の仮説: 検証レイヤーの構造的結合 — 個々の検証(govlintの参照整合チェック、Cucumberの
  未定義ステップ検出)はそれぞれ正しく設計通りに機能しているが、両者が同じ命名空間(シナリオID)を
  介して間接的に結合していることが、今回まで露見していなかった。これまでのスライス(RSV-C/K/A/R)は
  すべて「契約承認→シナリオ起票→実装」を1つのスライスとして連続実行してきたため、契約とシナリオの
  間に時間差(下書きだけを先にmainへ置く)を作る運用が一度も試されておらず、構造的制約が顕在化しな
  かった
- 押し込み先: **今回は当面の運用規律で回避**——受け入れシナリオは実装スライスと必ず同じ粒度で
  land させる(契約の"形状＋決定"だけを先に確定させ、シナリオIDを伴う受け入れシナリオそのものは
  実装とセットで初めて置く)。本件のGET /roomsでは、`reservation-rooms.feature`を除去し、API形状
  (paths定義・スキーマ)とADR裁定(adr/0007)だけを本改訂の成果物とした。受け入れシナリオ(RSV-L、ID
  は予約)は次の実装スライスでtesterが起こし、developerが実装して緑にする。**恒久策は将来オプション
  として記録するに留める**: Cucumberの`@pending`相当のタグでシナリオをL4実行対象から明示的に除外し、
  govlintも`@pending`タグ付きシナリオを「定義済みだが未実装」として区別して扱う機構を作れば、契約と
  実装の間の時間差を許容できる可能性がある。ただし1回目の発生であり、テンプレート/ツール変更は
  再発時(cause_key `scenario-id-couples-l0-and-l4`の2回目)に判断する
- 補足: この摩擦は、frontend側の設計↔契約整合性監査(consumer-driven contractの決定)が
  backend側の契約ドラフトを駆動し、そのbackend契約が初めて「シナリオを実装より先にドラフトする」
  という新しい運用パターンを踏んだことで露呈した。frontendとbackendという2プロジェクトをまたぐ
  連動が、単一プロジェクト内の反復では見えなかった構造的制約を可視化した点は記録に値する

---

## FR-015: ADRの承認記録が、承認後にしか書けず単独の価値が見えない2本目のPRを要求するため飛ばされ、承認済みのADR4本が「提案中」のまま残った

```yaml
id: FR-015
date: 2026-07-29
found_at: AI
slice: ADR-0032の規程本体への織り込み（その前提確認）
agents: [orchestrator]
cause_category: 記録の更新が別PRを要求する
cause_key: record-update-needs-second-pr
pushed_to: [meta/adr/0035-adr-approval-record-convention.md]
status: 対応済み
principles: [P-04, P-11]
```

- 事象: ADR-0032の帰結（規程本体への織り込み）に着手する前提としてADRの承認状態を確認したところ、ルート
  `activeContext.md` が「承認済み」と記述しているADR-0031〜0034が、4本とも frontmatter は
  `status: 提案中` / `approved_by: null` のままだった。人間の裁定は「承認済みが正・記録漏れ」。さらに
  棚卸しすると**提案中のまま滞留しているADRは10本**（最古11日）あり、そのうち `meta/adr/0026`
  （ブランチ運用・CI構成）と `meta/adr/0024`（走破）は**`meta/guardrails.md`・`meta/adr/0032` が
  すでに根拠として依存している**——承認済みの規程が未承認の決定の上に立っていた
- 原因の仮説: 記録の更新が別PRを要求する — ADRは承認前に起草するので `提案中` で書くしかなく、承認行為の
  実体は**そのPRのマージ**である。したがって承認の事実をファイルに書くには**マージ後に2本目のPR**が要る。
  その差分は frontmatter 2行のみでレビュー対象も無く、単独では価値が見えないため飛ばされる。**規律の
  不足ではなく手順の構造**であり、徹底の呼びかけでは直らない（P-04）。実際、ADR-0028だけは
  `status: 承認済み` ＋ `approved_by: "本PRのマージをもって承認"` と起草時に書いて**1本のPRで閉じて
  おり**、正しく記録されていた。意図してそう書いたわけではないが構造として正しいのはこちら
- 押し込み先: meta/adr/0035 — (1)ADRを含むPRは承認方式を二択で明示する（**(i)マージ＝承認**を既定とし、
  起草時に `承認済み` ＋ `approved_by` を書く／**(ii)記録のみ・承認は後日**は意図した保留の場合に限る）。
  PRテンプレのチェック項目にする。(2)govlintに `[REPORT] 提案中のまま滞留しているADRの棚卸し`（経過
  日数つき）を追加。**ERROR化はしない**——「承認されるべきか」は意味判定で機械が確定できず、日数閾値で
  CIを赤にすると正当な保留が罰され内容を伴わない承認を誘発する（P-04）。(3)既存の提案中10本は一括承認
  せず、REPORTで可視化した上で人間が個別に判断する
- 補足: 最も悪い帰結は本数ではなく、`提案中` が「まだ決めていない」を意味しなくなったことである。
  意図的な保留（`reservation-frontend/adr/0004`・`0005` は本当に承認待ち）と単なる記録漏れが混ざり、
  読み手が区別できなくなっていた。なお本FRはテンプレート自身の手順に関する摩擦だが、meta層の
  friction-logは存在しない（govlintは `projects/*/friction-log.md` しか走査しない）。FR-010・FR-012
  （HANDOFF.md・ルートREADME/activeContext＝いずれもmeta層の摩擦）の先例に倣い本ファイルに置いた。
  `meta/friction-log.md` の新設要否はADR-0035の「確認事項」として人間に投げてある

---

## FR-016: role定義をruntime用と共通原本の2か所へ手動複製し、SSOTを宣言した後も実体を一元化しなかったため責務がドリフトした

```yaml
id: FR-016
date: 2026-07-30
found_at: 人間
slice: agent-role-ssot
agents: [orchestrator, architect, developer]
cause_category: 同一契約の手動複製
cause_key: role-contract-manual-copy-drift
pushed_to: [meta/adr/0036-make-claude-role-definitions-the-single-source-of-truth.md, meta/tools/govlint.py]
status: 対応済み
principles: [P-03, P-04, P-10]
```

- 事象: `.claude/agents/<role>.md` と `meta/agents/<role>.md` に5役の責務・禁止事項・model・toolsを
  全文複製していた。ADR-0029とPR #30で`meta/agents`を共通契約と宣言した後も複製構造を残したため、
  architectの監査申し送り責務がClaude側だけ欠落し、designerでは参照パスが分岐した。人間からのSSOT
  違反報告で発覚した。Codex対応時にruntime mappingだけを追加し、既存コピーを整理しなかった見逃しを含む
- 原因の仮説: Claude Codeが自動発見する配置とruntime間で共有する契約の所有場所を分けようとして、
  一方を機械生成・参照adapterにせず双方へ同じ本文を書いた。同期を人間とAIの注意に依存させたため、
  「共通契約」という文言と実際にClaudeが読むファイルが分離し、更新ごとにドリフト可能な構造になった
- 押し込み先: ADR-0036で`.claude/agents/<role>.md`をClaude/Codex共通の唯一の原本と裁定し、重複する
  `meta/agents/<role>.md`を削除する。Codexは原本とruntime対応表を読む。govlintは旧roleファイルの再作成、
  role集合、Claude frontmatterとruntime対応表の投影不一致をL0エラーとして検出する
- 補足: 移行時に既存2系統を照合し、欠落していたarchitectの責務を原本へ回収した。役割責務とモデル対応
  自体は変更していない

---

## FR-017: サンドボックス内のCLI探索失敗をホスト環境での不存在と誤認し、利用可能な`gh`を使えないと報告した

```yaml
id: FR-017
date: 2026-07-30
found_at: 人間
slice: codex-gh-host-discovery
agents: [orchestrator]
cause_category: 実行環境の可視範囲をホスト全体と同一視
cause_key: sandbox-visibility-mistaken-for-host-absence
pushed_to: [meta/adr/0037-require-codex-host-cli-discovery-before-unavailability-report.md, AGENTS.md]
status: 対応済み
principles: [P-05, P-08, P-10]
```

- 事象: Codexが通常サンドボックス内のPowerShellで`Get-Command gh`と`where gh`に失敗した結果だけを根拠に、
  GitHub CLIが環境に無いと報告した。人間から「コマンドプロンプトでは使える」と指摘され、必要な権限昇格を
  伴うホスト側確認を行うと、WinGet管理の`gh`実体・バージョン・認証済み状態を確認できた。ブランチとruleset
  の結果自体は正しかったが、利用可能な標準手段を確認せずブラウザやREST直接呼び出しへ迂回した
- 原因の仮説: Codexの通常シェルに見えるPATHと、権限昇格後のホスト側から参照できるPATHを区別せず、1つの
  探索面の失敗をホスト全体の事実へ一般化した。CLI実体、認証状態、対象操作の権限・network到達性も分離して
  診断していなかった
- 押し込み先: ADR-0037で、利用不能報告の前にホスト側標準探索または既知の絶対パスを読み取り専用で確認し、
  実体・認証・権限・networkを別々に報告することを決定した。`AGENTS.md`へCodex固有手順を反映し、token、
  credential store、秘密を含み得る環境変数を出力しない境界も明記した
- 補足: ホスト全体の再帰探索や、CLI発見を外部操作の承認とみなすことは採用していない。今回確認した実体の
  絶対パスや認証情報はpublicリポジトリへ記録しない

---

## FR-018: シナリオIDのlint規則が言語依存で、日本語の助詞が続く参照を検出せず、行頭の散文を「定義」と誤認していた（既存契約が緑なのは偶然だった）

```yaml
id: FR-018
date: 2026-07-30
found_at: AI
slice: RFE-C（自分の予約・キャンセル）の契約起草
agents: [architect, orchestrator]
cause_category: lint規則が言語依存で偶然通っていた
cause_key: lint-rule-language-dependent
pushed_to: [meta/adr/0038-scenario-id-resolution-and-namespace.md]
status: 対応済み
principles: [P-01, P-04, P-10]
```

- 事象: architectがRFE-Cの受け入れシナリオを起草し「既存契約との矛盾は見つからなかった」と報告したが、
  orchestratorがgovlintにかけると**ERROR 4件で落ちた**（`RFE-B-03` の定義重複1件、`RSV-K-02`・`RSV-K-08`・
  `RSV-K-09` の未定義参照3件）。差し戻して修正する過程で、**同じことをしている既存ファイルが通っている**
  ことに気づき実装を測定したところ、`check_scenario_ids` に3つの欠陥が見つかった: (1)参照の単語境界に
  `\b` を使っており、Pythonの `\w` がUnicodeを含むため**日本語の助詞が直後に来る参照（`RSV-C-10が…`）を
  検出しない**、(2)行頭コメントがIDで始まれば「定義」と誤認するため**説明のための散文が実在しない定義を
  生む**（`reservation-booking.feature:55` が実際に `RSV-C-05` を偽定義していた）、(3)検査が
  `projects/<p>/contracts` 単位で閉じており**ADR-0023/0025が認めるクロスプロジェクト参照を原理的に
  解決できない**
- 原因の仮説: lint規則が言語依存で偶然通っていた — 「同じ内容を書いても**書いた位置と直後の1文字**で
  通るか落ちるかが変わる」状態だった。`reservation-rules.feature:22` の `# RSV-R-02で明示的に…` は
  直後が `で` のため偶然セーフだが、(1)だけを直すと重複エラーになる。3つの欠陥が互いに打ち消し合って
  いたため、**検査が空振りしていることに誰も気づけなかった**。P-01（正しさを機械検証に置く）を掲げて
  いても、その機械検証自体が言語依存の穴を持てば保証は成立しない
- 押し込み先: meta/adr/0037 — 参照の境界をASCIIで定める／定義はIDが行の主語（続くのが行末かコロン）の
  ときだけとする／名前空間をリポジトリ全体で1つにする、の3点を**同時に**入れる。既存の定義36行は
  1件も壊れず（実測）、重複検出が全体に効くため検査は緩まず強くなる。新テスト7件を追加し、うち3件が
  **旧実装に対して実際に落ちることを確認した**（テストが欠陥を捕まえていることの検証）
- 補足: agent側の見逃し（機械検証を通さず「矛盾なし」と報告した）が直接の引き金だが、**それは発見の
  契機にすぎない**。architectはBashを持たない役割定義であり自分でgovlintを実行できないため、「agentが
  検証を怠った」で終わらせるとorchestratorが毎回代行する運用依存が残る。役割が実行手段を持たない場合の
  検証責任の所在（誰がどの段で機械検証を通すか）は本FRでは解決していない——同じ形の摩擦が再発したら
  そこを構造で直す判断に進む


---

## FR-019: 機密ガードレールが、守るべきもの（Write・git混入）を守らず、守らなくてよいもの（`.env.example`）を止めていた

```yaml
id: FR-019
date: 2026-07-30
found_at: 人間
slice: キャンセルの実接続（4本目）の後始末
agents: [orchestrator, developer]
cause_category: ガードレールが例文のまま熟慮されていない
cause_key: guardrail-copied-from-example-untailored
pushed_to: [meta/adr/0040-secret-guardrail-scope.md]
status: 対応済み
principles: [P-01, P-04, P-08]
```

- 事象: 4本目の実接続の後 `.env.example` にフラグを追記しようとしたが、権限設定が `.env*` を deny して
  おり Read/Edit とも拒否された。**3本目でも同じ壁に当たっており、2スライス連続でテンプレートの保守が
  止まっていた**。人間が「`.env.example` は機密ではないのに、なぜ deny なのか」と問うたことから調査に
  入り、**3つの穴**が見つかった: (1) `Write` が1件も deny されていない（`Read`×11・`Edit`×8・`Bash`×14
  に対し `Write`×0）——読めず編集もできないファイルを**丸ごと上書き・新規作成できる**、(2) `.gitignore`
  に機密の記述が1件も無い——しかも `.env.example` 自身が「`.env.local`（gitignore対象）にコピーせよ」と
  **存在しない保護を案内していた**、(3) `.env.*` が広すぎて `.env.example` を巻き込んでいた
- 原因の仮説: ガードレールが例文のまま熟慮されていない — 本リポジトリの `Read(./.env)` /
  `Read(./.env.*)` は **Claude Code 公式ドキュメントの permissions 例文と完全に一致する**。例文を拡張
  （`./**/` 変種と `Edit` を追加）しただけで、**守備範囲を自分の要件に照らして設計し直していなかった**。
  例文が `Read` だけだったため `Edit` までは足したが `Write` に気づかず、`.env.*` の広さが自分たちの
  `.env.example` を巻き込むことにも気づかなかった。**3つの穴が「守り過ぎ」と「守らなさ過ぎ」の両方向に
  同時に出ている**のは、方針ではなくコピーが出所であることの徴候である
- 押し込み先: meta/adr/0040 — テンプレートを `.env*` の名前空間から出す（`.env.example` →
  `env.example`）／`Read`・`Edit`・`Write` を対称に deny し `.env` パターンを `./**/.env*` に広げる／
  `.gitignore` に機密の実ファイルを追加する。**default-deny は緩めない**。あわせて `meta/guardrails.md`
  §3 を同一PRで改訂した（従来「読み取り禁止」としか書いておらず、書き込み・コミットに触れていなかった）
- 補足: 「default-deny を保ったまま `.env.example` だけ通す」ホワイトリスト案を**実地検証して不可能と
  確定させた**（対照実験で設定がセッション中に反映されることを先に確認した上で、`!` による除外も
  allow による上書きも効かないことを測定）。ADR-0038（lintの言語依存）・ADR-0039（denyのprefix一致の
  穴）に続き、**「効いていると思っていた機構が実は効いていない」の3例目**である。cause_key は分けた——
  0038/0039 は「規則の書き方が甘い」だが、本件は「**規則の出所が例文であり、要件に照らして設計されて
  いない**」という一段手前の欠陥のため

---
<!--
記入のコツ:
- 「その場で」書く。棚卸しでまとめて書かない（記憶で精度が落ちる）
- 押し込み先が「ドキュメント追記」になるのは最後の手段（P-04: ルール化できるものは文章で書かない）
- **cause_key は新規に作る前に既存を見る**。同じ原因なら同じキーを使う（同原因2回の検出はこのキーの一致で行われる）
- 同じ原因のFRが2回出たら、それは構造的な欠陥。規程・テンプレートへの変更提案を出す
-->
