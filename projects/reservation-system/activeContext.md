# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-17

## 今どこにいるか

垂直スライス4本（予約の作成RSV-C / キャンセルRSV-K / 空き枠確認RSV-A / 予約ルール確認RSV-R）が全段緑・マージ済み。ADR-0014（検証インフラの所有明示）もマージ済み。いまはPR #14（ブランチ b-layer/domain-model-pack）を進めている。当初B層初回パックを作ったが、人間の premise 問い（「B層必要？」）で**破棄**（FR-013: N=1での早すぎ抽出）。PRは「B層を空に戻す＋root掃除＋govlint拡張」に組み替え済み。

**B層の再定義（人間と合意 2026-07-18）**: B層は「昇格で埋まる任意のカタログ」。A→B一方向依存（Bは前提でなく選択肢）、型=A/実体=B、低儀式・マッチ制。実プロジェクトで(スタック×役割)が実証され2本目が欲しがった時に、汎用スケルトンとして昇格して埋める（書き溜め禁止）。今は在庫ゼロ、reservation-systemが最初の種。

## 次にやること

1. PR #14（B層を空に戻す＋root掃除＋govlint）→ CI → 人間マージ
2. **② B層再定義をarchitecture-selection.mdに明文化**（architectが数行、低儀式。上記合意の転記。meta変更=マージで承認）。PR #14に同梱予定
3. **① 承認アーティファクトの一般ルール化** → ADR-0016起草済み・PR中（ブランチ meta/adr-0016-approver-summary）。「人間が承認する成果物は先頭に承認者向けサマリを置く」をP-01の運用規約として明文化。原則P-12でなくADR（ADR-0011→0014の先例）。ADR-0002/0010はsupersedeせず包摂。機械検査は構造の有無のみ可能＝developer宿題。※ADR番号: 破棄したB層ADRの0015はtombstone欠番、本件は0016
4. **クロスセッション経路の実地検証**: ルーティン化したスライスをフレッシュセッションに「HANDOFF読んで進めて」で拾わせる

## 確定した主要な判断

- ドメインモデルパック(ADR-0001) / Java+Spring Boot+JPA(ADR-0002)
- ドメイン設計はDDDワークの判断群に従う(docs/workshop-summary-01-reservation.md): 小さいReservation集約 + DB排他制約(EXCLUDE, btree_gist, WHERE cancelled_at IS NULL)、半開区間[start,end)、営業時間・定員はスナップショット、状態は導出(ReservationStatus.of())、Clock注入
- 予約者は社員に限定しない(ADR-0003)。日マタギは構造的禁止(ADR-0004)。キャンセルは本人のみ(ADR-0005)。空き枠は予約可能な空きのみ返す(ADR-0006)
- seam: POST /test-support/rooms(roomId応答) / DELETE /test-support/reservations(clockもリセット) / PUT /test-support/clock。acceptance限定。正式仕様はcontracts/test-support-api.yaml
- 検証: L0 govlint(統治文書) → L1〜L4。統治文書のメタデータはfrontmatter＝機械検証対象(ADR-0012)
- orchestratorは実質的成果物を作らない。検証ハーネスの所有=ci.yml(orchestrator・自己検証)/build.gradle・govlint(developer・テスト付き)/ゲート(人間)(ADR-0014)

## 未着手の技術的宿題（スライス作業として消化）

- スキーマ照合の新旧混在: RSV-Rの新規検証はyaml原本を直読み、既存(空き枠・拒否応答全般)は手写しのまま、予約作成・キャンセルの成功応答は未適用。段階移行の判断が要る(ADR-0007の全面適用)
- stepクラス`ReservationCreateSteps`への集約が4スライスで肥大。分割にはCucumberのglueインスタンス共有制約→DI(cucumber-picocontainer)追加の要否判断(build.gradle)

## 環境メモ

- JDK: Amazon Corretto 23(JAVA_HOME明示が必要)。ビルド: Gradle wrapper 8.14
- コンテナ: Podman稼働。統合テストは DOCKER_HOST=npipe:////./pipe/podman-machine-default, TESTCONTAINERS_RYUK_DISABLED=true。手動コンテナはlocalhost転送されず、SUT起動時はWSLのIP(`podman machine ssh "ip -4 addr show eth0"`)へ接続

## 直近のfriction

- FR-001〜011 記録済み(friction-log.md、メタデータ付き)。FR-001(HANDOFF参照素材の所在・実害なし)のみ未対応、他は対応済み
- govlintが報告中の未解決シグナル: cause_key `approval-artifact-readability-convention-missing` 3回(上記①で対処予定)
