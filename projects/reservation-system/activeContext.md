# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-14

## 今どこにいるか(スライスRSV-K)

スライスRSV-K「予約をキャンセルできる」の全段検証が完了(2026-07-15)。人間承認3点(契約・骨格追記seam・step実装)済み。L1(87テスト+PIT 39/39 kill)・L2・L3(実DB統合、部分排他制約を両層確認)・L4(19本全緑=RSV-C回帰込み)。reviewer差し戻し1件(Then検証のフィールド不足)は修正・再監査で解消。残り: PR作成→CI→人間マージ。
規程改善バッチ#2の候補が4件揃っている(下記)。friction はFR-008まで記録。

## 前スライスの到達点(RSV-C)

**スライスRSV-C「予約を作成できる」の検証が全段完了**（2026-07-14）。人間の承認3点（契約・設計骨格・step実装）済み、L1（単体39件+checkstyle+PIT 29/29 kill）・L2（ArchUnit）・L3（API契約整合+DB統合9件、EXCLUDE制約の最終防衛を実機確認）・L4（受け入れシナリオ10本、実SUTに対し全緑）。reviewer監査レポート（reviews/audit-rsv-c.md）に人間承認を記録済み。PR #1はCI全緑で人間がマージ済み（squash、2026-07-14）。リモート: github.com/Vazial/ai-driven-dev-template（Private）。現在は規程改善バッチ（meta/adr/0001〜0005）を提案中。

## 確定した主要な判断

- ドメインモデルパックを採用（ADR-0001）。実装スタックはJava + Spring Boot + JPA（ADR-0002）
- ドメイン設計はDDDモデリングワークの判断群に従う（docs/workshop-summary-01-reservation.md）: 小さいReservation集約 + DB排他制約（EXCLUDE, btree_gist, WHERE cancelled_at IS NULL）、半開区間[start, end)、営業時間・定員はスナップショット、Clock注入
- 予約者は社員に限定しない一般化（ADR-0003）
- 日マタギ禁止はシナリオ・拒否コードでなく構造的禁止（単一date+時刻2つのスキーマとTimeSlotの形）で強制（ADR-0004）
- 受け入れテスト用seam: POST /test-support/rooms（応答はroomIdフィールド）と DELETE /test-support/reservations。プロファイルacceptance限定（design.md）

## 進行中 / 次にやること

1. 規程改善バッチ#2のPR(meta/adr/0007〜0010 + 規程/雛形反映 + テストインフラ契約の初適用) — マージ=承認
2. 次スライスでの宿題: (a)DSLへのOpenAPIスキーマ照合の組み込み(meta/adr/0007の実装。steps/dsl差分承認が必要なためスライス作業として実施) (b)RSV-K監査の申し送り注記の確認(attendeeCount期待値の定数依存・stepクラス名)
3. 次スライス候補: 予約の参照・一覧(読み取りモデル。CQRSの読み側)等 — 人間と相談して決定
4. 中期: B層「ドメインモデルパック実体」を本プロジェクトの実証済み部品から抽出(ビルド骨格・ArchUnit・seamパターン・CI)

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
