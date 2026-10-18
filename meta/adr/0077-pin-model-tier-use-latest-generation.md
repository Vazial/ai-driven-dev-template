---
id: 0077
scope: meta
status: 承認済み
date: 2026-10-11
approved_by: "Linear KEN-56 の指示（モデルの指定を階級＋最新世代にして対応表を最新にする）。ADR-0075により、PRINCIPLES等5文書に触れない運用表の更新はAIが自律して起票・マージしてよい"
supersedes: []
superseded_by: null
relates_to: [0004, 0036, 0048, 0075]
---

# ADR-0077: Codexのモデルは階級で固定し、世代は最新を使う

> **承認者向けサマリ**: `meta/agent-runtime-mapping.md` はCodexのモデルを `gpt-5.6-*` の固定名で持っていたが、
> 現在のCodexには6・6.1世代がある。役割に割り当てる本体を「階級（luna / terra / sol / astra）」とし、
> 世代は階級内の最新を使う決め方に改め、表を最新にした。階級の割り当て（ADR-0048）は変えない。
> 結果: ClaudeとCodexを混ぜる基本の構成では developer・tester が `gpt-6-luna`（設計とレビューはClaude）。
> どちらか一方しか使えないときは、Codexは全roleを `gpt-5.6-terra` にそろえる（6世代にterraが無いため5.6が最新）。

## 文脈

ADR-0048は役割ごとの階級（Luna-first、判断・監査はTerra以上）を決めたが、記述は `gpt-5.6-*` の固定名だった。
Codexのモデル一覧（`~/.codex/models_cache.json`、2026-10-11）には `gpt-6.1-sol`（最新の主力）、`gpt-6-astra`、
`gpt-6-sol`、`gpt-6-luna` があり、`gpt-5.6-*` は「Older generation」と注記されている。固定名のままでは、
世代が上がるたびに階級の議論と名前の更新が混ざる。

## 決定

1. 割り当ての本体は階級とする。世代はその階級の最新を使う（一覧が「Older」とするものは最新でない）。
2. 階級に最新世代が無いときは、その階級の最新世代を使い、階級を変えない（terraは5.6が最新）。
3. 世代更新は表・既定の実行先・`orchestration.md` の例を同じPRで更新する。階級を変えるときだけADRを起こす。
4. 利用不能なときに別モデルへ黙って代替しない規定（agent-runtime-mapping.md）は維持する。

5. どちらか一方のruntimeしか使えないとき、Codexは全roleを階級terraにそろえる（人間指示 2026-10-18）。
   Luna・Solの使い分けは、ClaudeとCodexを混ぜる基本の構成（単純作業はLuna、設計とレビューはClaude）に限る。

## 結果

- 2026-10-11の表（Codexだけで回すとき）: 全roleが`gpt-5.6-terra`。混ぜて回すときのdeveloper/testerは`gpt-6-luna`。
- Claude側は `sonnet` / `opus` の別名が常に最新を指すため変更なし。
- 未確認: Orca経由の `--model gpt-6-luna` 起動での実動作。最初のdispatchで確かめる。
