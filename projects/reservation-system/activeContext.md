# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-14

## 今どこにいるか

**スライスRSV-C「予約を作成できる」の検証が全段完了**（2026-07-14）。人間の承認3点（契約・設計骨格・step実装）済み、L1（単体39件+checkstyle+PIT 29/29 kill）・L2（ArchUnit）・L3（API契約整合+DB統合9件、EXCLUDE制約の最終防衛を実機確認）・L4（受け入れシナリオ10本、実SUTに対し全緑）。reviewer監査レポート（reviews/audit-rsv-c.md）に人間承認を記録済み。残り: ブランチslice/rsv-cのmasterへのマージ（人間のみ実施可）と、規程改善バッチ。

## 確定した主要な判断

- ドメインモデルパックを採用（ADR-0001）。実装スタックはJava + Spring Boot + JPA（ADR-0002）
- ドメイン設計はDDDモデリングワークの判断群に従う（docs/workshop-summary-01-reservation.md）: 小さいReservation集約 + DB排他制約（EXCLUDE, btree_gist, WHERE cancelled_at IS NULL）、半開区間[start, end)、営業時間・定員はスナップショット、Clock注入
- 予約者は社員に限定しない一般化（ADR-0003）
- 日マタギ禁止はシナリオ・拒否コードでなく構造的禁止（単一date+時刻2つのスキーマとTimeSlotの形）で強制（ADR-0004）
- 受け入れテスト用seam: POST /test-support/rooms（応答はroomIdフィールド）と DELETE /test-support/reservations。プロファイルacceptance限定（design.md）

## 進行中 / 次にやること

1. slice/rsv-c → master のマージ（人間の判断・実施待ち）
2. 次スライス候補: 「予約をキャンセルできる」（ワーク素材にreservation-cancel.featureあり。cancelled_at・15分前期限・部分排他制約の本領）
3. スライス完了後の規程改善バッチ（人間指示・ADR起票して判断を仰ぐ）:
   - FR-003の押し込み: meta/templates/への受け入れシナリオ雛形追加
   - meta/agents/原本への model: sonnet 追加（.claude/agents/デプロイ側は設定済み。原本変更はADR必須）
   - **「設計骨格の承認以降に人間の判断が必要になった場合、ADRをセットで起票する」規則の提案**（FR-004/005の押し込みの一般化。人間発案 2026-07-14）。その際「friction-logにも記録するか」の判定基準（人間判断=誤りの兆候とは限らないため、frictionは「AIが迷った/誤った」場合のみ等）も併せて定義する

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
