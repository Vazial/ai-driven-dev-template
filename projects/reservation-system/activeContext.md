# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-14

## 今どこにいるか

**スライスRSV-C「予約を作成できる」の検証が全段完了**（2026-07-14）。人間の承認3点（契約・設計骨格・step実装）済み、L1（単体39件+checkstyle+PIT 29/29 kill）・L2（ArchUnit）・L3（API契約整合+DB統合9件、EXCLUDE制約の最終防衛を実機確認）・L4（受け入れシナリオ10本、実SUTに対し全緑）。reviewer監査レポート（reviews/audit-rsv-c.md）に人間承認を記録済み。PR #1はCI全緑で人間がマージ済み（squash、2026-07-14）。リモート: github.com/Vazial/ai-driven-dev-template（Private）。現在は規程改善バッチ（meta/adr/0001〜0005）を提案中。

## 確定した主要な判断

- ドメインモデルパックを採用（ADR-0001）。実装スタックはJava + Spring Boot + JPA（ADR-0002）
- ドメイン設計はDDDモデリングワークの判断群に従う（docs/workshop-summary-01-reservation.md）: 小さいReservation集約 + DB排他制約（EXCLUDE, btree_gist, WHERE cancelled_at IS NULL）、半開区間[start, end)、営業時間・定員はスナップショット、Clock注入
- 予約者は社員に限定しない一般化（ADR-0003）
- 日マタギ禁止はシナリオ・拒否コードでなく構造的禁止（単一date+時刻2つのスキーマとTimeSlotの形）で強制（ADR-0004）
- 受け入れテスト用seam: POST /test-support/rooms（応答はroomIdフィールド）と DELETE /test-support/reservations。プロファイルacceptance限定（design.md）

## 進行中 / 次にやること

1. 規程改善バッチのPR（meta/adr/0001〜0005 + 雛形 + 規程反映）— レビュー・マージ待ち。マージ後にADRの状態を承認済みへ更新する
2. 次スライス候補: 「予約をキャンセルできる」（ワーク素材にreservation-cancel.featureあり。cancelled_at・15分前期限・部分排他制約の本領）

## 環境メモ

- JDK: Amazon Corretto 23（PATH先頭はJava 8なのでJAVA_HOME明示が必要）
- ビルド: Gradle wrapper 8.14（projects/reservation-system/gradlew.bat）。ビルド骨格はorchestrator管理（今スライスで変更なし）
- コンテナ: Podman稼働中（DOCKER_HOST=npipe:////./pipe/podman-machine-default、TESTCONTAINERS_RYUK_DISABLED=true）。**手動コンテナのポートはWindowsのlocalhostに転送されない**（Testcontainers経由は問題なし）。ホストからはWSLのIP（`podman machine ssh "ip -4 addr show eth0"`で確認、再起動で変わる）に直接接続する。人間が夜にWSL更新+machine作り直し予定（2026-07-14時点）

## 未解決の論点

- branch protectionはリモートホスト未接続のため手順書のみ（guardrails/branch-protection.md）
- step定義lintの具体ツールは未確定（guardrails/step-definition-lint.md）
- CI（.github/workflows/ci.yml）はジョブ骨格のみ。実コマンド埋めが必要（テストは./gradlew test等で実行可能になった）
- POST /reservationsの契約未定義領域は実装判断で埋めた: 部屋が存在しない→404（ProblemResponse同形, code=ROOM_NOT_FOUND）、リクエスト形式違反→Spring既定の400

## 直近のfriction

- FR-001（未対応: HANDOFF参照素材の所在不明 → 手動共有で解消中）
- FR-004まで記録済み（friction-log.md）
