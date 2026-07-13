# HANDOFF.md — Claude Codeセッションへの引き継ぎ書

> 読者: このリポジトリで作業を開始するClaude Code（および人間）。
> これは初回オンボーディング用の文書。日常の状態把握はactiveContext.mdを読むこと。

## 1. これは何か

**AI駆動開発のメタレベル・テンプレートシステム（A層）**。特定のプロジェクト用ではなく、あらゆるプロジェクトに適用する「AI駆動開発そのものの基盤」。

中核思想（詳細は meta/PRINCIPLES.md の P-01〜P-11）:
- **正しさの保証は、人間のレビューではなく機械化された検証に置く**（P-01）
- 人間の承認は4点のみ: 契約 / 設計骨格 / step実装 / 規程変更
- SSOTは「実行可能 > 機械検証可能 > 人間可読」（P-03）
- 契約は垂直スライス単位で先に確定。Big Design Up Frontはしない（P-02）

## 2. 3層構造における位置づけ

| 層 | 内容 | 状態 |
|---|---|---|
| A. メタ層 | 本リポジトリのmeta/。言語非依存 | **完成（guardrails実体を除く）** |
| B. スタック層 | 技術スタック別・設計パック別の部品 | 未着手。初適用時に「ドメインモデルパック」から作る |
| C. ドメイン層 | 各プロジェクトの実際のモデル・シナリオ | 予約システムが最初の適用先 |

## 3. ファイル構成と読む順

```
HANDOFF.md            ← 今ここ（初回のみ）
activeContext.md      ← 毎セッション必読。「現在」のSSOT
meta/
  README.md           ← A層の索引
  PRINCIPLES.md       ← 信条P-01〜P-11。全agent常時ロード
  permissions.md      ← 権限マトリクス・エスカレーション・矛盾分析レポートの型
  verification.md     ← 多段保証L1〜L5。L4（step実装）の詳細が最重要
  agents.md           ← 4agent体制の設計とスライス標準フロー
  architecture-selection.md ← プロジェクト開始時の設計パック選定
  guardrails.md       ← 運用ルール索引（実体設定は未作成 → 5節参照）
  agents/             ← subagent個別定義4枚（.claude/agents/ にコピーして使う）
  templates/          ← 成果物雛形6枚（adr / pull-request / audit-report / friction-log / active-context / architecture）
```

推奨の読む順: activeContext → PRINCIPLES → agents.md → verification.md。残りは必要時に参照。

## 4. agent体制（要点のみ・詳細はagents.md）

- **architect**: 契約ドラフト・整合性チェック・ARCHITECTURE.md維持（コードを書かない）
- **developer**: 実装+単体テスト、L1〜L3を緑に（契約read-only、steps/に触らない）
- **tester**: step定義・DSL作成（**実装コードを読まない** — これが保証の一部）
- **reviewer**: 独立監査・対訳表作成（**testerの意図説明を見ずコードだけ読む**）

スライスの流れ: architect（契約→人間承認）→ developer/tester並行 → reviewer監査 → 人間が対訳表とシナリオを突き合わせて承認 → CI全緑 → 人間がマージ。

## 5. 次のタスク: 予約システムへの初適用

会議室予約システム（EventStorming・ADR8本・Gherkin素材が既存）を最初の適用先とする。

1. リポジトリ初期構成: meta/を配置、agents/を.claude/agents/へ、templates/からactiveContext・ARCHITECTURE・friction-logの実体を生成
2. **guardrails実体の作成**（未完了の唯一の書き物。実物がないと書けないためここで作る）:
   - .claude/settings.json のpermissions（deny: .env・秘密鍵、testerのsrc/読み取り禁止パス等）
   - branch protection設定、CI設定（L1→L2→L3→L4の順、下で落ちたら上を実行しない）
   - step定義lint（分岐禁止・行数上限）— 実現手段の調査から
3. architectでアーキテクチャ選定（architecture-selection.md → ADR第1号）
4. 最初の垂直スライス「予約を作成できる」で4agentフローを一周回す
5. **friction-log運用開始**: AIが迷った瞬間をその場で記録（テンプレート改善の一次データ。これがこの初適用の真の目的）

## 6. 忘れてはいけない運用ルール

- AIが自律更新できるのは activeContext.md / friction-log.md / ARCHITECTURE.md（承認済み決定の投影のみ）の3つだけ
- 契約を満たせない時は止まって矛盾分析レポート（permissions.md 3節）。仮定で突き進まない
- meta/配下の変更はADR必須・人間承認必須
- スライスの区切りでactiveContext.mdを上書き更新してから次へ進む
