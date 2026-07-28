---
id: 0029
scope: meta
status: 提案中
date: 2026-07-28
approved_by: null
supersedes: [0004]
superseded_by: null
relates_to: [P-01, P-04, P-07, P-08]
---

# ADR-0029: 役割agent定義をCodexのディスパッチ規約と実行モデルへ接続する

> **承認者向けサマリ**: `meta/agents/` には役割定義があるが、Codexはそのファイルを自動で発見・適用しない。
> 役割を起動する時に必ず定義ファイルを読ませる規約を `AGENTS.md` に置き、Claude固有の `sonnet` / `opus`
> 指定をCodexで利用可能な `gpt-5.6-terra` / `gpt-5.6-sol` へ対応づける。役割分離は維持され、実行環境が
> roleごとのツール制限を強制できない点は、強制済みと誤認しない。

## 文脈

`meta/agents/*.md` は役割ごとの責務、禁止事項、読むべきソースを定めている。一方で、これはClaude向けの
frontmatter（`model: sonnet` / `model: opus`）を含むプロンプトライブラリであり、Codexのsubagent起動では
自動参照されない。このままでは、役割分離を意図しても、起動時に役割定義を読ませる保証がない。

ADR-0004は役割定義の原本にClaudeのモデル指定を置くことを決めた。しかし現在のCodex実行環境では
`gpt-5.6-terra` と `gpt-5.6-sol` が選択可能であり、Claudeエイリアスをそのまま指定しても実行時の
モデル選択にはならない。

## 決定

1. `AGENTS.md` をCodexの実行時ディスパッチ規約とする。役割agentを起動する前に、orchestratorは
   対象の `meta/agents/<role>.md` を全文読み、role名・ファイルパス・既存の成文ソースだけをdispatchに渡す。
   dispatchへドメイン判断を注入しない制約はADR-0011を継続する。
2. role定義の `model` はCodexの実行モデル名とする。旧指定の対応は `sonnet` → `gpt-5.6-terra`、
   `opus` → `gpt-5.6-sol` とし、architect/developer/tester/reviewerにはterra、designerにはsolを指定する。
3. 指定モデルが利用できない場合、orchestratorは別モデルへ黙って代替しない。利用不能を報告し、人間の
   判断またはこの対応表の更新を待つ。
4. role定義の `tools` は意図した能力境界として保持する。Codexの実行環境がrole単位のツール許可を
   技術的に強制できない場合も、agentは定義の禁止事項を守る。sandboxで強制されているかのようには報告しない。

## 検討した代替案

- 案A: `meta/agents/` をそのままプロンプトライブラリとして手動参照する / 不採用の理由: 参照漏れを
  防げず、今回観測した「規約はあるがCodexの実行に接続されない」問題を解消しない。
- 案B: Claudeの `sonnet` / `opus` を維持する / 不採用の理由: Codex実行時のモデル選択に使えず、定義と
  実行が再び乖離する。
- 案C: roleごとのツール制限を技術的に強制済みとみなす / 不採用の理由: 現行runtimeにはその保証がない。
  意図した境界は役割定義と運用で守り、強制範囲を正確に記録する。

## 帰結

- 役割agentを使う時の起動規約は `AGENTS.md` に直接適用される。role定義を読まないdispatchは規約違反となる。
- モデルの改廃やCodex runtimeの対応変更時は、role定義と本ADRを更新し、人間レビューを通す。
- 本ADRはADR-0004をsupersedeする。ADR-0017/0018のdesignerの役割・品質上の意図は維持し、そこでの
  `opus` という実行名のみを `gpt-5.6-sol` に置き換える。
