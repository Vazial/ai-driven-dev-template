# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-22

## 今どこにいるか

垂直スライス4本（予約の作成RSV-C / キャンセルRSV-K / 空き枠確認RSV-A / 予約ルール確認RSV-R）が全段緑・マージ済み。ADR-0014（検証インフラの所有明示）もマージ済み。いまはPR #14（ブランチ b-layer/domain-model-pack）を進めている。当初B層初回パックを作ったが、人間の premise 問い（「B層必要？」）で**破棄**（FR-013: N=1での早すぎ抽出）。PRは「B層を空に戻す＋root掃除＋govlint拡張」に組み替え済み。

**B層の再定義（人間と合意 2026-07-18）**: B層は「昇格で埋まる任意のカタログ」。A→B一方向依存（Bは前提でなく選択肢）、型=A/実体=B、低儀式・マッチ制。実プロジェクトで(スタック×役割)が実証され2本目が欲しがった時に、汎用スケルトンとして昇格して埋める（書き溜め禁止）。今は在庫ゼロ、reservation-systemが最初の種。

**GET /rooms（RSV-L、2026-07-22）: API形状＋ADR-0007まで決定済み。受け入れシナリオ＋バックエンド実装は次スライスで未了**。
経緯: reservation-frontend側の設計↔契約整合性監査（`reservation-frontend/design/reconciliation/
booking-design-reconciliation.md`）で残っていた未決2件のうち1件。人間が「reservation-systemに追加する・
フロントの必要から形を決める（consumer-driven contract）」と決定し、architectが契約ドラフトを起草した:
`contracts/reservation-api.yaml`のRSV-L追記（API形状のみ）、`adr/0007`（役割分担の裁定、ドラフト）。
既存の`GET /rooms/{roomId}/rules`（RSV-R）は無変更のまま維持（一覧＝概要、/rules＝予約前詳細、で役割分担）。

当初、architect（前任）は受け入れシナリオ（`contracts/reservation-rooms.feature`、RSV-L-01〜03）も
同時にドラフトしたが、CIで構造的な問題が発覚し**除去した**: シナリオIDが govlint（L0、参照するシナリオ
IDは.featureに定義必須）と Cucumber（L4、定義されたシナリオはステップ定義（実装）必須）の両方を結合
しており、「実装より先にシナリオだけを下書きする」状態を構造的に作れない（.featureを置けばL4が
Undefined Stepで落ち、.featureを消せばL0が未定義参照で落ちる。詳細はfriction-log.md FR-014）。人間の
決定により、**位相を validation/decision（本改訂: API形状＋ADR裁定）と scenario/implementation（次
スライス: 受け入れシナリオ＋実装）に分離**した。この分離の理由は、赤い（実装未了の）シナリオをmainに
コミットしない規律を保つため——各コミット・各スライドは自分の粒度で自己完結・緑であるべきで、
プロジェクト全体としての「まだ終わっていない」はactiveContext（本ファイル）が追跡すれば足りる。
モック・契約（形状＋決定）はスライスの区切りより先に置いてよいが、実装とセットで初めて緑になる受け入れ
シナリオは、置くタイミングを実装と合わせる必要がある。

**次スライスで行うこと（未着手）**: tester がRSV-L-01/02/03相当の受け入れシナリオを起こし（一覧内容・
name昇順・0件=空一覧、ADR-0007の決定1〜6が仕様）、developerがdomain/application/adapter実装とともに
緑にする。`test-support-api.yaml`の`DELETE /test-support/rooms`（会議室ゼロ件の前提用）は、消費者
（RSV-L-03相当のシナリオ）が無くなったため一旦削除した。実装スライスで必要になれば再導入する。

## 次にやること

1. PR #14（B層を空に戻す＋root掃除＋govlint）→ CI → 人間マージ
2. **② B層再定義をarchitecture-selection.mdに明文化**（architectが数行、低儀式。上記合意の転記。meta変更=マージで承認）。PR #14に同梱予定
3. **① 承認アーティファクトの一般ルール化** → ADR-0016起草済み・PR中（ブランチ meta/adr-0016-approver-summary）。「人間が承認する成果物は先頭に承認者向けサマリを置く」をP-01の運用規約として明文化。原則P-12でなくADR（ADR-0011→0014の先例）。ADR-0002/0010はsupersedeせず包摂。機械検査は構造の有無のみ可能＝developer宿題。※ADR番号: 破棄したB層ADRの0015はtombstone欠番、本件は0016
4. **クロスセッション経路の実地検証**: ルーティン化したスライスをフレッシュセッションに「HANDOFF読んで進めて」で拾わせる
5. **RSV-L「会議室の一覧を確認できる」の契約ドラフト（人間承認待ち）**: `contracts/reservation-api.yaml`のRSV-L追記（API形状のみ）・`adr/0007`をレビューし、承認可否・修正要否を判断する。承認後、次スライスとして受け入れシナリオ（tester）＋実装（developer）にB層等と並行して着手できる

## 確定した主要な判断

- ドメインモデルパック(ADR-0001) / Java+Spring Boot+JPA(ADR-0002)
- ドメイン設計はDDDワークの判断群に従う(docs/workshop-summary-01-reservation.md): 小さいReservation集約 + DB排他制約(EXCLUDE, btree_gist, WHERE cancelled_at IS NULL)、半開区間[start,end)、営業時間・定員はスナップショット、状態は導出(ReservationStatus.of())、Clock注入
- 予約者は社員に限定しない(ADR-0003)。日マタギは構造的禁止(ADR-0004)。キャンセルは本人のみ(ADR-0005)。空き枠は予約可能な空きのみ返す(ADR-0006)
- seam: POST /test-support/rooms(roomId応答) / DELETE /test-support/reservations(clockもリセット) / PUT /test-support/clock。acceptance限定。正式仕様はcontracts/test-support-api.yaml
- 検証: L0 govlint(統治文書) → L1〜L4。統治文書のメタデータはfrontmatter＝機械検証対象(ADR-0012)
- orchestratorは実質的成果物を作らない。検証ハーネスの所有=ci.yml(orchestrator・自己検証)/build.gradle・govlint(developer・テスト付き)/ゲート(人間)(ADR-0014)

## 未着手の技術的宿題（スライス作業として消化）

- スキーマ照合の新旧混在: RSV-Rの新規検証はyaml原本を直読み、既存(空き枠・拒否応答全般)は手写しのまま、予約作成・キャンセルの成功応答は未適用。段階移行の判断が要る(ADR-0007の全面適用)
  - ※命名注意: 上記「ADR-0007」はスキーマ照合移行の文脈で以前から使われていた仮の参照名。2026-07-22に番号としてのADR-0007を「GET /rooms追加・役割分担」に採番したため、この宿題項目が指す先は再確認・改称が必要（架空の重複ではなく、記述の古さによる表記ゆれ。次にこの宿題に着手する時に正しいADR番号へ改める）
- stepクラス`ReservationCreateSteps`への集約が4スライスで肥大。分割にはCucumberのglueインスタンス共有制約→DI(cucumber-picocontainer)追加の要否判断(build.gradle)
- **RSV-L受け入れシナリオ＋実装が未着手**（本ファイル冒頭参照）。次スライスとしてtester→developerに引き継ぐ

## 環境メモ

- JDK: Amazon Corretto 23(JAVA_HOME明示が必要)。ビルド: Gradle wrapper 8.14
- コンテナ: Podman稼働。統合テストは DOCKER_HOST=npipe:////./pipe/podman-machine-default, TESTCONTAINERS_RYUK_DISABLED=true。手動コンテナはlocalhost転送されず、SUT起動時はWSLのIP(`podman machine ssh "ip -4 addr show eth0"`)へ接続

## 直近のfriction

- FR-001〜013 記録済み(friction-log.md、メタデータ付き)。FR-001(HANDOFF参照素材の所在・実害なし)のみ未対応、他は対応済み
- **FR-014（新規、本改訂）**: シナリオIDがgovlint(L0)とCucumber(L4)を結合し、「実装より先にシナリオだけを下書きする」状態を構造的に作れないことが、GET /rooms(RSV-L)契約ドラフトのCI失敗で判明。受け入れシナリオ層を今回の契約から剥がし、次スライスに持ち越すことで回避。未対応(恒久策は将来オプション)
- govlintが報告中の未解決シグナル: cause_key `approval-artifact-readability-convention-missing` 3回(上記①で対処予定)
