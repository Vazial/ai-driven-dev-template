// App.tsx は本番エントリ（断面②で実装が入る配線の起点）。
// design-preview（査読用の受け皿・src/design-preview/）は本番実装ではないため、
// ここから import しない（import境界。meta/adr/0022 §2「design-previewは本実装から
// architecturally 隔離する」）。この隔離はビルド設定（tsconfig.app.json の除外・
// design-preview.html という別entry）とESLintの no-restricted-imports で担保する。
//
// 現時点は契約スライスの実装がまだ無いため、最小のプレースホルダを描画する
// （断面②で実装が入る）。design-previewを開発時に見るには、`npm run dev` 起動後に
// `design-preview.html` を開く（詳細: design-preview/index.tsx のコメント）。
function App() {
  return (
    <main>
      <p>reservation-frontend: 実装は断面②（実装合意）で追加されます。</p>
    </main>
  )
}

export default App
