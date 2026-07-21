---
id: 0002
scope: project/reservation-frontend
status: 承認済み
date: 2026-07-18
approved_by: "人間承認"
supersedes: []
superseded_by: null
relates_to: []
---
# ADR-0002: 会議室予約フロントエンドは独立したプロジェクトとして新設する

## 文脈

バックエンド（projects/reservation-system）に対するフロントエンドを新規に立ち上げるにあたり、既存
プロジェクトのディレクトリ内に画面層を追加するか、独立したプロジェクトとして新設するかを判断する必要が
ある。ADR-0001でフロントエンドの設計パック（シンプルCRUDパック）を評価した結果、バックエンド
（ドメインモデルパック）とは明確に異なる特性を持つことが分かっている。

## 決定

**新規に独立したプロジェクト`projects/reservation-frontend/`を作る**。`projects/reservation-system/`
の中には置かない。

理由:

- パックが異なる（バックエンド=ドメインモデルパック、フロントエンド=シンプルCRUDパック）。ADRの採番・
  適用中の設計パック・稼働する検証段の構成（L1〜L4のツール）がプロジェクト単位で別物になり、1つの
  ディレクトリに同居させると規約が混在する
- ADR採番・friction-log・activeContext.mdは各プロジェクトが1系列ずつ持つ（既存reservation-systemの
  構成に準拠）。フロントエンドを同居させると、どちらのADR系列に属するかが曖昧になる
- ビルド・依存関係の技術基盤が独立する見込み（Java/Gradle系 対 TypeScript/Node系、ADR-0003）。同一
  ディレクトリに混在させると、CIのL1〜L4の実行順序・依存関係lintの対象範囲が複雑化する
- 契約（reservation-api.yaml）はバックエンド側にSSOTとして残し、フロントエンドはそれを外部参照する。
  この関係は「別プロジェクトが既存の契約を消費する」という単純な一方向依存として表現するのが最も明確

ディレクトリ構成規約（案。設計骨格の承認後、design.mdへ正式化する）:

```
projects/reservation-frontend/
  activeContext.md
  friction-log.md
  adr/                     … このプロジェクト独自のADR系列（0001から採番）
  contracts/               … 受け入れシナリオ（.feature）のみを置く。API仕様は複製せず
                              projects/reservation-system/contracts/reservation-api.yaml を直接参照する
  src/
    screens/<画面名>/       … 画面コンポーネントと画面固有の薄いロジック
    api-client/             … reservation-api.yaml から生成された型・クライアント（生成物。手書き禁止）
    shared/                 … 画面間で共有する表示部品・ユーティリティ（業務ロジックは持たない）
  e2e/
    steps/                  … step定義（シナリオ文とDSLの対応付けのみ。testerの領分）
    dsl/                    … 画面操作を業務語彙で関数化したテスト専用ライブラリ
```

依存方向（L2で構造検証予定）: `screens → api-client`、`screens → shared`。逆流禁止。api-clientと
sharedは互いに依存しない。

## 検討した代替案

- 案A: `projects/reservation-system/frontend/` のように既存プロジェクト内のサブディレクトリとする /
  不採用の理由: 上記の4理由（パックの違い・ADR系列の曖昧化・ビルド系統の混在・契約参照の非対称性）
- 案B: `projects/reservation-system-frontend/` のような名称で既存プロジェクトとの結びつきを名前に残す /
  不採用の理由: 検討したが、独立プロジェクトである実態と名前を一致させる方を優先し、`reservation-frontend`
  という短い名前に一本化した（内容としては案Aの否定と表裏であり、独立させる決定自体に変わりはない）

## 帰結

- 良い影響: バックエンド/フロントエンドそれぞれが独立したADR系列・activeContext・検証パイプラインを
  持てる。パックの異なる2プロジェクトが1リポジトリに共存する初の実例になり、B層カタログ（現状は空、
  architecture-selection.md 6節）の将来の昇格候補として「シンプルCRUDパック × TypeScript系フロント」
  という新しい系列が生まれうる
- トレードオフ: 契約（reservation-api.yaml）の変更がバックエンド側で起きた際、フロントエンド側への影響
  伝播を意識的に追跡する必要がある（自動的な依存通知の仕組みは本ADRの範囲外）
- 波及する作業: projects/reservation-frontend/ディレクトリの新設、activeContext.md・friction-log.md
  の雛形からの起票（本ADRに同梱してドラフト済み）
