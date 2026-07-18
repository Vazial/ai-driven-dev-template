# HANDOFF.md — 入口

> このリポジトリで作業を始めるClaude Code（および人間）が最初に開く1枚。
> ここは**入口ポインタに徹する**。中身は各文書が持ち、ここでは繰り返さない（重複は必ずドリフトする。ADR-0013・P-04）。

## これは何か

**AI駆動開発のメタレベル・テンプレートシステム**。正しさの保証を人間のレビューではなく機械化された検証に置き、人間の承認を4点（契約 / 設計骨格 / step実装 / 規程変更）に集約する。思想の全ては meta/PRINCIPLES.md（信条P-01〜P-11）が持つ。

3層構造: **A層**=meta/（言語非依存の基盤） / **B層**=技術スタック・設計パック別の部品 / **C層**=各プロジェクトの実体（projects/）。

## どこから読むか

1. **projects/<プロジェクト>/activeContext.md** — 「今どこにいて次に何をするか」の唯一のSSOT（P-11）。フレッシュセッションはここで進行中のスライスに合流する。現在の適用先は `projects/reservation-system/`
2. **meta/PRINCIPLES.md** — 全agentが常時ロードする信条
3. **meta/agents.md** — agent体制（architect / designer / developer / tester / reviewer。designerはUIを持つプロジェクトのみ登場、meta/adr/0017）と、コンテキスト分離の理由と、スライスの標準フロー
4. **meta/README.md** — A層の文書索引（残りの規程・雛形・道具はここから辿る）

必要に応じて meta/verification.md（多段保証L1〜L5）、meta/permissions.md（権限・エスカレーション）を参照する。

## この文書自体の扱い

HANDOFF.mdは不変のオンボーディング。進捗・次のタスクといった揮発性の状態は持たない（activeContextの領分）。変更はA層規程と同格でADR必須・人間承認（permissions.md）。
