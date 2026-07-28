# friction-log.md

> 追記専用。AIが迷った・誤った・曖昧な指示で事故った瞬間を**その場で**記録する（P-05）。
> 各エントリは「下の段への押し込み」（P-10）まで書けたら完了。テンプレート改善の一次データ。

---

## FR-001: ADRドラフトのレビュー経路をPRとして適用できなかった

```yaml
id: FR-001
date: 2026-07-28
found_at: 人間
slice: プロジェクト開始
agents: [architect]
cause_category: 規程の適用漏れ
cause_key: pr-review-route-not-applied
pushed_to: [meta/guardrails.md, meta/templates/pull-request.md, meta/adr/0006-adr-approval-via-pr-merge.md]
status: 対応済み
principles: [P-04, P-05, P-10]
```

- 事象: ADRドラフトのローカル検証状況を報告した際、成果物の人間レビューとCI検証の標準経路がPRであることを、
  既存規程から適用できなかった。
- 原因の仮説: `guardrails.md`、PRテンプレート、ADR-0006に分散している既存ルールを、成果物レビューの判断に
  結び付けず、ローカル環境の検証可否を先に扱った。
- 押し込み先: 規程の欠落ではないため新たな文章は追加しない。以後は成果物のレビュー・CI結果をPR単位で扱い、
  既存の `guardrails.md`・PRテンプレート・ADR-0006を適用する。
