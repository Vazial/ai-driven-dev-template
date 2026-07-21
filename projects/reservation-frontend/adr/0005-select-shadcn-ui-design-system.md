---
id: 0005
scope: project/reservation-frontend
status: 提案中
date: 2026-07-19
approved_by: null
supersedes: []
superseded_by: null
relates_to: [P-01, P-02, P-09]
---
# ADR-0005: 視覚の土台としてshadcn/ui（Radix UI + Tailwind CSS）を採用する

## 文脈

meta/adr/0017が定めた並行モデルの手続きに従い、architectとdesignerがそれぞれ異なる評価軸から
デザインシステムの候補を提案し、人間が最終選定を行った。

**architect提案（スタック・設計適合の観点。候補: shadcn/ui第1・Mantine第2・MUI不推奨）**:
- shadcn/uiの利点: TS+React+Vite（ADR-0003）への統合コストが低い、ランタイムコストがほぼゼロ
  （ビルド時CSS、Radixは軽量プリミティブのみ）、コンポーネントが自分の`src/`にコピーされる=隠れた
  依存・抽象を持ち込まない、というシンプルCRUDパック（ADR-0001「層を圧縮する・生成系ツール活用」）
  との哲学的整合が最も強い。Radixのアクセシビリティ既定値も強い
- Mantine: バンドル・統合コストは妥当だが、フル機能コンポーネント一式の「導入」であり、shadcnほど
  「層を圧縮する」哲学に忠実ではない
- MUI: CSS-in-JSランタイム・テーマプロバイダという追加抽象層がCRUDパックの方針と噛み合わず、
  Material Designの強い視覚的出自がブランド未確定の現状と噛み合わないため不推奨

**designer提案（UI/UX品質・モック再現性の観点。orchestrator経由で共有された要旨。詳細な理由づけは
designer自身の成果物であり、architectは再導出しない）**: Mantineを第1候補、shadcn/uiを第3候補とした。

**人間の決定**: 両angleの提案を踏まえ、人間が**shadcn/ui（Radix UI primitives + Tailwind CSS）**を
選定した。architectの第1候補と一致する。designerの提案では第3候補だったが、人間が最終判断として
shadcnを選んだ（選定理由の詳細は人間の判断であり、本ADRはその選定を記録するにとどめる。architectは
この選定自体を再検討しない。meta/adr/0011）。

## 決定

視覚の土台として **shadcn/ui（Radix UI primitives + Tailwind CSS）** を採用する。

### 採否のトレードオフ（記録）

**利点**:
- コード所有: コンポーネントは`src/`に直接コピーされ、隠れたベンダー依存・抽象層を持ち込まない
  （ADR-0001のCRUDパック哲学「層を圧縮する」と直接整合）
- ランタイム最小: ビルド時にCSSへコンパイルされる（Tailwind）。CSS-in-JSのランタイムオーバーヘッド
  が無い
- アクセシビリティ既定が強い: Radixのプリミティブがキーボード操作・ARIA属性を内蔵する
- 生成APIクライアント（openapi-typescript等、ADR-0003 L3）とは疎結合。データ層への意見を持たない

**留意点（今後の設計・実装で埋める必要がある事項）**:
- 日付・時刻・数値ピッカー等の複合コンポーネントは、Radixのプリミティブから**自分で組み立てる必要が
  ある**（Mantine等の「フル機能」ライブラリと異なり既製品が無い）。今後実装する画面（日付指定入力等）
  で組み立てコストが発生する
- 視覚的に白紙（Tailwindは既定のルックを持たない）。designerが視覚的なcraftを一から組む負担を負う
  （「ダサい」問題の再発リスクは、shadcn自体でなくdesignerの運用＝refinementループで吸収する。
  meta/adr/0017 §4、下記「refinement / escape hatch」参照）

## ADR-0004との境界解決（reconciliation・最重要）

**矛盾の所在**: shadcn/uiは実コンポーネントを`src/`にcopy-inする方式である。一方でADR-0004は
「モックは静的HTML/CSS・`src/`のビルド対象に含まれない」ことを忠実度の境界条件（§1「実装コード禁止
事項との切り分け」条件1「出荷経路に乗らない」）として定め、designerは実装コード（`src/`）を読まない
というコンテキスト遮断を持つ（meta/adr/0017）。shadcnコンポーネントが`src/`にある以上、designerが
それを直接参照・importすることは、この2つの既存の境界と衝突する。

**解決方針**: designerの画面モックは、**shadcnの意匠を「近似」する自己完結の静的HTML/CSS**として
作る。`src/`のcopy-inコンポーネントを**import・参照しない**。出荷実装（developer）が`src/`の実
shadcnコンポーネントを使う。**モックは視覚の近似、実装が実体**という役割分担にする。

- designerは、shadcnの公開ドキュメント・デザイントークン（配色・角丸・余白のスケール等、公開情報）を
  参考に、独立した静的HTML/CSSでその意匠を再現する。実際の`src/`配下のコンポーネントコードは読まない
  （コンテキスト遮断は維持される）
- モックと実装（developerが`src/`に実際に組むshadcnコンポーネント）が**クラス単位で完全一致すること
  は求めない**。近似で構わない。差分は次の2つの機構で詰める:
  1. **refinementループ**（meta/adr/0017・ADR-0004 §6）: 人間クリティークを経てdesignerが反復する
  2. **L5**（体験の質）: 実装後、実際のReactアプリの見た目・操作感を人間が最終確認する
- この切り分けにより、ADR-0004の境界（モックは`src/`非依存）とdesignerの禁止事項（`src/`を読まない）
  はどちらも変更せずに維持される。designerの確認点「モック再現性の方式をどうするか」への回答が本節
  である

**波及**: ADR-0004 §1の「除外」に「shadcnの`src/`側実コンポーネントの直接参照」を明示的に追記する
必要がある（本ADR承認後、architectが着手）。

## スタックへの波及（ADR-0003への追補）

ADR-0003（TypeScript + React + Vite、歴史的に承認済み）の本文は書き換えない（P-06: 決定は更新せず
新しい決定で置き換える）。本ADRが追補する形で、Tailwindツールチェーンの追加を記録する:

- Tailwind CSS（Viteの公式統合。PostCSS経由、追加のビルドステップは小さい）
- shadcn/ui CLI（コンポーネントを`src/`にコピーする。npm依存としてはRadix UI primitivesのみが残る。
  shadcn自体はパッケージとしてインストールされない）
- L1（Vitest）・L2（依存境界lint）・L4（Playwright）等、ADR-0003が定めた段構成に変更は無い。追加の
  L2ルールが要るか（例: `screens`から`src/components/ui`＝shadcnのcopy-in層への依存は許可するが、逆は
  禁止、等）は、design.md新規作成時にarchitectが具体化する

## refinement / escape hatch

meta/adr/0017が定めたrefinementループ・escape hatchの**枠組みに従う**。本ADRは視覚の土台の**方式
（shadcnへの近似モック）を確定するのみ**であり、洗練の反復回数N・実用水準に届かない場合の代案は
ADR-0004 §6が定める（本ADRでは決定しない。ADR-0004 §6は「未定」のまま残っている。次に判断する）。

## B層との関係（architecture-selection.md §6）

本選定は`project/reservation-frontend`スコープのinline採用であり、B層カタログへの昇格は行わない。
B層は「同スタック・同型の2本目のプロジェクトが現れた時に昇格」の原則（§6）に従う。TS+React+Vite×
shadcn/uiの組み合わせを再利用する2本目のReactフロントエンドプロジェクトが現れた時、昇格を判断する
候補になる。

## 検討した代替案

- 案A: Mantine（designer提案の第1候補） / 不採用: 人間が最終的にarchitect提案の第1候補（shadcn/ui）
  を選定した。Mantineはフル機能コンポーネントの導入という点でCRUDパックの「層を圧縮する」哲学とは
  shadcnほど噛み合わないが、UI/UX品質・再現性の観点では有力な対抗馬だったことを記録に残す
- 案B: MUI / 不採用: architect提案でも不推奨（CSS-in-JSランタイム・Material Designの強い視覚的出自）
- 案C: デザインシステムを選定せず、designerが都度自由に視覚デザインする / 不採用: meta/adr/0017が
  「ダサい」問題の根治としてデザインシステムの活用そのものを原則化しており、この案自体が原則と矛盾する
- 案D: designerに`src/`のshadcnコンポーネントを直接読ませる（コンテキスト遮断の例外を作る） / 不採用:
  designerのコンテキスト遮断（実装コードを読まない）は「実装都合のバイアス排除」という独立した目的を
  持ち、デザインシステムの選定如何で緩めるべきものではない。モックは近似で十分機能する（refinement
  ループとL5が差を詰める）ため、遮断を崩す必要は無いと判断した

## 帰結

- 良い影響: RFE-Aを含む今後のモック・実装が、一貫した視覚言語（shadcn/Radix/Tailwind）の上に乗る。
  designerはレイアウト・構成・状態設計に集中でき、developerはコンポーネントを自分のコードとして
  所有できる（ベンダーロックインが薄い）
- トレードオフ: 複合コンポーネント（日付・数値ピッカー等）の組み立てコストがdeveloper/designer側に
  残る。モックと実装の近似という切り分けにより、両者の見た目が細部で一致しない期間が生じうる
  （refinementループとL5で収束させる想定）
- 波及する作業:
  - ADR-0004 §1「除外」への追記（shadcnの`src/`側実コンポーネントを直接参照しない旨の明示）
  - ADR-0003への追補（Tailwind/shadcn CLIのツールチェーン、本ADRに記載済み。ADR-0003本文は不変）
  - 既存のRFE-Aモック（旧 design/mocks/rfe-a-availability-view/）をdesignerがshadcnの意匠に近似する形で
    作り直す（activeContext.mdの既存論点、本ADR承認後に着手）
    ※注記(2026-07-20): この静的モックの実ファイルは削除済み（superseded・最終成果物にならないため。
    ADR-0004改訂ノート参照）。RFE-AスコープはBookingDesign.tsxが包含するため、独立の作り直しは不要の見込み
  - refinementループの反復回数N・escape hatchの代案の具体化（ADR-0004 §6、引き続き未定）
  - design.md新規作成時、L2依存境界ルールにshadcnのcopy-in層（例: `src/components/ui`）の扱いを
    明記する（architectが着手）
