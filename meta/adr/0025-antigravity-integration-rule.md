---
id: 0025
scope: meta
status: 提案中
date: 2026-07-27
approved_by: "人間の明示的な承認"
supersedes: []
superseded_by: null
relates_to: ["P-01", "P-04", "P-07"]
---

# ADR-0025: Antigravity(Gemini)環境におけるプロジェクト共有ルールの導入とツール固有設定の連携

## 承認者向けサマリ

> **概要**: Antigravity（Gemini）が当プロジェクトのガバナンスとツール固有役割（architect等）を遵守して動作できるよう、`.agents/AGENTS.md` を設置し、既存の `meta/` や `.claude/` への参照構造を導入する。
> **人間への確認事項**: 参照元を再定義・複製しない（P-04）方針で、Antigravityをテンプレートシステムに組み込む本方針を承認するか。

## 文脈

Antigravity（Gemini）セッション起動時、`.claude/` 配下に配置されているツール固有のエージェントプロンプト（`architect.md`, `designer.md` 等）や `meta/` 配下の成文ルールは自動で読込コンテキストに含まれない。
このため、Antigravity エージェントがメタ規程（P-01〜P-11）や役割定義を認識・遵守するためには、Antigravityのカスタマイズ機構（`customizations`）に適合した共有ルールの定義が必要となった。

## 決定

1. ワークスペース直下に `.agents/AGENTS.md` をプロジェクト共有ルールとして配置する。また、同ディレクトリがAntigravity用設定のルートであることと、SSOTを再定義しない旨を `.agents/README.md` に文書化する。
2. `.agents/AGENTS.md` にて、SSOTである `meta/` 配下の規程（`PRINCIPLES.md`, `agents.md`, `permissions.md`, `verification.md`, `architecture-selection.md` 等）および `.claude/agents/*.md` への参照・遵守指示を明記する。
3. 異種ツール固有の設定を二重化・複製せず、`.agents/AGENTS.md` から既存の設定ファイルへ参照（リンク）する構成とし、ドリフト（乖離）を防止する（P-04）。

## 検討した代替案

- 案A: `.claude/agents/*.md` の内容を `.agents/skills/` 等に複製する / 不採用: 同一の役割定義が複数箇所に存在することになり、将来の変更時に必ず内容のドリフト（乖離）が発生する（ADR-0013, P-04）。
- 案B: セッションごとに人間がチャットプロンプトで都度ルールを指定する / 不採用: ルール化できるものを手作業や揮発性の文章で書かない原則（P-04）に反する。

## 帰結

- Antigravity エージェントが起動時に `.agents/AGENTS.md` を自動読込し、`ai-driven-dev-template` のガバナンスおよびツール固有役割定義を透過的に遵守して動作できるようになる。
- 複製を持たない参照構造のため、`meta/` や `.claude/` の更新がそのまま Antigravity 側にも反映される。
- `.agents/README.md` により、今後のAntigravity固有の拡張を行う際にも、SSOTを侵さない規律が維持される。
