# 再現性検証（reproducibility check） — FR-004

designerフロー (a)ブリーフ作成・(b)外部AI実行 の**再現性を確かめた1回限りの検証記録**。
「原案としてOK」に到達した設計（試行1）が、手順を踏めば毎回同水準で得られるのかを確認した。

## 収録物
- `room-availability-and-booking-brief.md` — 過去の試行の記憶を持たないdesignerが、
  既存ブリーフ（`../../briefs/`）を見ずに独立して書いたブリーフ（試行2）
- `BookingDesignTrial2.tsx` — 上記ブリーフを、試行1と同一モデル（gemini-3-flash-preview）・
  同一伝送（generateContent API直叩き、meta/adr/0020）で撃って得た外部AI成果物（**無改変**）

## わかったこと
- **再現した**: designerの(a)は独立でも同じ8節構成・同水準の密度で書けた。(b)の伝送
  （`meta/tools/commission_design_api.py`）も初回実地で成功。不足API（会議室一覧・自分の予約一覧）の
  指摘も一貫していた
- **再現しなかった**: 出力の**骨格に本質的な分散**がある。承認された試行1は「全会議室を一望する
  タイムライン・予約者名の表示」。試行2は「1部屋ずつ条件を指定するステップフロー」——**人間が
  元々嫌っていた『部屋＋日付を指定して見る』構図への退行**だった
- 差の要因: 試行1のブリーフには人間由来の不満点4つが入っていた。独立designerはそれを知り得ず退行
  した。＝**人間由来の不満点は、骨格の分散に対して床を上げる**（外れを引きにくくする）

詳細は `../../friction-log.md` FR-004、`../../activeContext.md` を参照。

> 注: `BookingDesignTrial2.tsx` はレビュー用に受け皿（`src/design-preview/`）で描画した記録であり、
> 恒久的な出荷コードではない。再描画したい場合は `src/design-preview/` に一時的に置く。
