# ai-driven-dev-template

AI駆動開発の「進め方そのもの」を定めたテンプレート。特定の言語・フレームワーク用ではなく、
AIエージェントに実装を任せる開発すべてに敷く土台を目指している。

## 何を賭けているか

**正しさの保証を、人間のレビューではなく機械化された検証に置く。**

AIが書いたコードを人間が読んで確かめる運用は、量が増えた瞬間に破綻する。
だからこのテンプレートは、人間の関与を「意図の表明」と「重要判断の承認」だけに絞り、
正しさの確認は全部CIに寄せる。人間がAIの出力を読んで検証し始めたら、
それは検証設計が足りていないサインとして扱う。

人間が承認するのは次の4点だけ:

| 承認するもの | なぜ人間か |
|---|---|
| 契約（受け入れシナリオ・API仕様・ADR） | 「何が正しいか」は機械に決められない |
| 設計骨格 | 後から覆すコストが高い |
| step実装 | シナリオとコードの対応は機械検証できない |
| 規程変更（meta/ の変更） | ルール自体の変更は自己申告にできない |

信条は [meta/PRINCIPLES.md](meta/PRINCIPLES.md) の P-01〜P-11 に1ページで置いてある。
まずこれを読むのが早い。

## 多段保証（L1〜L5）

失敗はできるだけ機械に近い段で捕まえる。上の段で見つかった失敗は、
下の段の検証を強化する材料にする（P-10）。

| 段 | 見るもの | 手段 |
|---|---|---|
| L1 | 実装の内部品質 | 単体テスト・lint・mutation testing |
| L2 | 構造の健全性 | 依存方向・層構造の静的検証（ArchUnit） |
| L3 | 境界の整合 | API契約テスト・DB制約 |
| L4 | 仕様の充足 | 受け入れシナリオ実行（contracts/ がSSOT） |
| L5 | 体験の質 | VRT・ブラウザ操作agent・人間の最終判断 |

詳細は [meta/verification.md](meta/verification.md)。CIは下の段が落ちたら上を実行しない
（[.github/workflows/ci.yml](.github/workflows/ci.yml)）。

## 4つのagent

| agent | 役割 | 触らないもの |
|---|---|---|
| architect | 契約のドラフト・整合性チェック・アーキテクチャ選定 | 実装コード |
| developer | 実装と単体テスト。L1〜L3を緑にする | 契約・step定義 |
| tester | 承認済みシナリオからstep定義とテストDSLを作る | 実装コード（コンテキストを持たずに動く） |
| reviewer | testerの成果物を独立に監査し、対訳表を作る | step定義 |

**tester と reviewer を分けているのが肝**で、これは「誤解の自己申告」を防ぐため。
自分が書いたstepを自分で監査させると、シナリオを読み違えたまま
「シナリオ通りです」と報告が返ってくる。理由は [meta/agents.md](meta/agents.md) 3節。

## 構成

```
meta/          A層: 言語非依存の信条・規程・ADR・雛形。テンプレートの本体
projects/      C層: 適用先。実例として会議室予約システムが入っている
guardrails/    強制の実体（branch protection手順・lint）
.claude/       agent定義とdeny設定
```

B層（技術スタック別・設計パック別の部品）は、実プロジェクトで実証された(スタック×役割)を
「昇格」して埋めていく任意のカタログ（A→Bの一方向依存。前提でなく選択肢）。まだ何も昇格していない。
必要になったプロジェクトが現れた時に作る（P-02: 全体を先に設計しない）。

## 使い方

このリポジトリをテンプレートとして複製し、`projects/` の中身を自分のものに差し替える。
`meta/` はそのまま持っていく。

1. [HANDOFF.md](HANDOFF.md) を読む（このリポジトリで作業を始めるAI・人間向けの導入）
2. [meta/PRINCIPLES.md](meta/PRINCIPLES.md) の P-01〜P-11 を読む
3. `git config core.hooksPath .githooks` で Conventional Commits を強制する
4. architectに複雑度を評価させ、設計パックを選ばせる（ADR第1号として記録する。
   [meta/architecture-selection.md](meta/architecture-selection.md)）
5. 最初の縦切り1スライスの契約を書かせ、**人間が承認する**
6. developer と tester を並行で走らせる

## 状態

**実験中。実運用の推奨はまだできない。**

現在どこまで進んでいるか（揮発性の進捗）はこのREADMEには書かない（P-11: 現在状態は
activeContextが持ち、静的文書に進捗を持たせるとドリフトする。meta/adr/0013・0014の教訓）。
最新の状態は [projects/reservation-system/activeContext.md](projects/reservation-system/activeContext.md) を見る。

うまくいかなかったことは [projects/reservation-system/friction-log.md](projects/reservation-system/friction-log.md)
に、AIが迷った・誤った瞬間としてその場で記録している。
このログはテンプレート改善の一次データで、同じ原因が2回出たら構造的欠陥として
規程変更を提案する運用になっている。**成功例より、ここを読むほうが実態が分かる。**

## ライセンス

MIT License（[LICENSE](LICENSE)）。
