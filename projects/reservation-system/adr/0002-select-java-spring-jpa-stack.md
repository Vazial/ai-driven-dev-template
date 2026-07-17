---
id: 0002
scope: project/reservation-system
status: 承認済み
date: 2026-07-13
approved_by: "人間承認"
supersedes: []
superseded_by: null
relates_to: []
---
# ADR-0002: 実装スタックとしてJava + Spring Boot + JPAを採用する

## 文脈

ADR-0001でドメインモデルパックを選定した。パックの必須部品（構造検証・テスト戦略・CI実コマンド）を具体化するには実装スタックの確定が必要。DDDモデリングワークの設計判断（@Versionによる楽観ロック、部分排他制約、Clock注入）はJava/JPAの語彙で表現されており、そのまま実装に写せる。

## 決定

Java + Spring Boot + JPA（Hibernate）を採用する。多段保証の各段のツールは以下とする:

| 段 | ツール |
|---|---|
| L1 | JUnit 5 + AssertJ（単体）、Checkstyle（lint）、PIT（mutation testing） |
| L2 | ArchUnit（依存制約: ドメイン層は技術詳細に依存しない） |
| L3 | OpenAPI仕様からの型生成 + スキーマ整合検証 |
| L4 | Cucumber-JVM（受け入れシナリオ実行。step定義lintはPMDカスタムルール、guardrails/step-definition-lint.md 案B） |

## 検討した代替案

- 案A: TypeScript + Node.js / 不採用の理由: ワークの設計判断をJPA語彙から翻訳し直すコストが発生する。L1〜L4のツール構成は組めるが、今回は素材との連続性を優先
- 案B: Kotlin + Spring Boot / 不採用の理由: JPA資産はそのまま使えるが、素材との語彙一致という利点はJavaと同等で、追加の学習・設定コストに見合う差分がない

## 帰結

- 良い影響: ワークのADR 0001〜0008の設計判断（集約・並行制御・状態導出）を語彙変換なしで実装に写せる。L1〜L4の全段に成熟したツールが揃う
- トレードオフ: JVMのビルド時間がCIに乗る。mutation testing（PIT）は実行時間が長いため、対象パッケージの絞り込みが必要になる可能性
- 波及する作業: Gradleプロジェクトの初期化、CI（.github/workflows/ci.yml）の実コマンド化、ArchUnitルールとPMDカスタムルールの作成
