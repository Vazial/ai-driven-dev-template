# AGENTS.md — Antigravity (Gemini) プロジェクト共有ルール

## 承認者向けサマリ

> **概要**: Antigravity (Gemini) セッション起動時に自動ロードされるプロジェクト共通ルール。本ファイルは本リポジトリのメタ規程（`meta/`）およびツール固有エージェント定義（`.claude/agents/`）への参照指示をまとめ、異種AI環境からのガバナンス遵守を保証する。
> **人間への確認事項**: 本共有ルールを `.agents/AGENTS.md` に配置し、セッション共通ルールとして確定することを承認するか。

---

## 1. 必読・常時参照の成文ルール (SSOT)

作業開始時および各ロール実行時は、以下のファイルを優先して参照・遵守してください。

- **静的オンボーディング (入口)**: `HANDOFF.md` （リポジトリ全域の構造・A/B/C層の解説）
- **A層文書索引**: `meta/README.md` （規程・雛形・道具へのポインタ）
- **信条 (PRINCIPLES)**: `meta/PRINCIPLES.md` （P-01〜P-11）
- **エージェント役割・標準フロー**: `meta/agents.md`
- **設計パック選定基準**: `meta/architecture-selection.md`
- **権限・エスカレーション規程**: `meta/permissions.md`
- **検証規程 (L0〜L4)**: `meta/verification.md`
- **ガードレール規程**: `meta/guardrails.md`

## 2. ツール固有エージェント定義の読み込み指示

役割に応じた作業（設計、実装、テスト、監査等）を行う際は、以下の役割定義ファイルを `view_file` 等で読み込み、制約や関与境界を遵守してください。

- **architect (契約・モデルの番人)**: `.claude/agents/architect.md`
- **designer (デザインインテグレーター)**: `.claude/agents/designer.md`
- **developer (実装・単体テスト)**: `.claude/agents/developer.md`
- **tester (受け入れテスト・step定義)**: `.claude/agents/tester.md`
- **reviewer (受け入れテスト独立監査)**: `.claude/agents/reviewer.md`

## 3. アクション原則

1. **契約優先**: イテレーション（スライス）ごとに契約（API仕様・受け入れシナリオ・ADR）を確定させてから実装に進む。
2. **コンテキスト遮断の維持**: tester / reviewer、developer / tester 等のコンテキスト遮断ルール（`meta/agents.md`）を順守する。
3. **人間承認の確実な取得**: 契約 / 設計骨格 / step実装 / 規程変更の4つの承認ポイントでは、人間の明確な承認を得る。成果物先頭には「承認者向けサマリ」を配置する（ADR-0016）。
4. **明確なプロジェクト命名・ブランチ運用**: 新規プロジェクト開始時は具体的なドメイン名に基づくディレクトリ (`projects/<project-name>`) と Git ブランチ名 (`feature/<project-name>-...`) を用いる。
5. **機械検証の自走**: 統治文書・ADR・シナリオを追加・編集した際は、必ず `python meta/tools/govlint.py` を実行して L0 機械検証を通過させる（P-01, P-03）。
6. **動的状態の追跡 (activeContext.md)**: フレッシュセッション開始時やスライスの完了時、エスカレーション発生時は対象プロジェクトの `activeContext.md` を確認・更新する（P-11）。
7. **設計の現在地 (design.md)**: モジュール境界や責務の全体図は `design.md` を SSOT として参照・維持する（architect / developer。ルールはコードに置き、design.md には地図のみを描く）。
