---
id: NNNN
scope: meta | project/<プロジェクト名>
status: 提案中 | 承認済み | superseded
date: YYYY-MM-DD
approved_by: "本PRのマージをもって承認 | 人間裁定（<文脈>） | ..."
supersedes: []
superseded_by: null
relates_to: []
---

# ADR-NNNN: <決定を一文で>

## 文脈
<!-- どんな状況・制約・きっかけでこの判断が必要になったか。エスカレーション起点なら矛盾分析レポートへのリンク -->

## 決定
<!-- 何をすると決めたか。命令形で簡潔に -->

## 検討した代替案
<!-- 案ごとに1〜2行 + 採らなかった理由 -->
- 案A: ... / 不採用の理由: ...
- 案B: ... / 不採用の理由: ...

## 帰結
<!-- この決定で生じる良い影響・受け入れるトレードオフ・波及する作業 -->

---
<!--
frontmatter（機械可読なメタデータ。meta/adr/0012。meta/tools/govlint.py が検証する）:
- id: ファイル名の採番と一致させる
- scope: meta（A層の決定）か project/<名前>（そのプロジェクトの決定）。採番はscopeごとに独立
- status: 提案中 / 承認済み / superseded
- supersedes / superseded_by: 相手のADRのid。**対称**に書く（AがBをsupersedeするなら、Bのsuperseded_byはA、かつBのstatusはsuperseded）
- relates_to: 関連する信条(P-XX)・シナリオID・FR-XXX 等。参照先が実在することをlintが検証する

運用ルール（P-06）:
- 1決定1枚。承認後の本文編集は禁止
- 覆す時は新しいADRを書き、このファイルの status を superseded に変え superseded_by を設定するだけ
- 承認は人間のみ（permissions.md）。architectがドラフトする
- PRで提案するADRは、status を「承認済み」・approved_by を「本PRのマージをもって承認」と書いてよい（meta/adr/0006）
- **本文（文脈・代替案・帰結）はproseのまま**。理由・経緯・判断はスキーマ化しない（P-03）
-->
