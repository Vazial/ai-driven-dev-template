# activeContext.md — 会議室予約システム

> P-11: このファイルは常に「現在」だけを映す。更新は上書き。歴史はgitとADRが持つ。
> 更新タイミング: スライスの区切り、エスカレーション発生時（permissions.md）
> 最終更新: 2026-07-13

## 今どこにいるか

A層テンプレートの初適用プロジェクト。スライスRSV-C「予約を作成できる」の契約（受け入れシナリオRSV-C-01〜11 + API仕様）が人間に承認された（2026-07-13）。次はdeveloper（実装+単体テスト、L1〜L3）とtester（step定義+DSL、L4）の並行作業。実装スタックはJava + Spring Boot + JPA（ADR-0002承認済み）。

## 確定した主要な判断

- ドメインモデルパックを採用（ADR-0001・承認済み）。不変条件・状態遷移中心の業務システムのため
- ドメイン設計はDDDモデリングワークで確定済みの判断群に従う（docs/workshop-summary-01-reservation.md）: 小さいReservation集約 + DB排他制約、半開区間[start, end)、営業時間・定員はスナップショット、状態は導出（ReservationStatus.of()に一元化）、並行制御2層（@Version + 部分排他制約）、Clock注入

## 進行中 / 次にやること

1. スライスRSV-C: developer（実装+単体テスト）とtester（step定義+DSL）の並行作業 → reviewer監査 → 人間が対訳表を突き合わせて承認 → CI全緑
2. 実装前の準備: JDK/ビルドツールの環境確認、スライス用ブランチ作成、Gradleプロジェクトの骨格
3. FR-003の押し込み: meta/templates/への受け入れシナリオ雛形追加の変更提案（人間の判断待ち。スライス完了後にでも）

## 未解決の論点

- 実装スタック未確定。ワーク素材は@Version等Java/JPA前提の語彙だが、正式決定はADRとして記録が必要
- ワーク側ADR全文・.featureファイル2本の取り込みが未了（サマリーのみ取り込み済み）
- branch protectionはリモートホスト未接続のため手順書のみ（guardrails/branch-protection.md）。有効化はリモート接続後に人間が実施
- step定義lintの具体ツールは未確定（guardrails/step-definition-lint.md）。スタック確定後に決定
- CI（.github/workflows/ci.yml）はL1〜L4のジョブ骨格のみ。実コマンドはスタック確定後に埋める

## 直近のfriction

- FR-001（未対応: HANDOFF参照素材の所在不明 → 手動共有で解消中）
