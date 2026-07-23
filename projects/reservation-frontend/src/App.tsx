// App.tsx は本番エントリ（断面②で実装が入る配線の起点）。
// design-preview（査読用の受け皿・src/design-preview/）は本番実装ではないため、
// ここから import しない（import境界。meta/adr/0022 §2「design-previewは本実装から
// architecturally 隔離する」）。この隔離はビルド設定（tsconfig.app.json の除外・
// design-preview.html という別entry）とESLintの no-restricted-imports で担保する。
//
// RFE-A「会議室の空き状況を画面で確認できる」スライスの実装として、本番ルートに
// AvailabilityScreen を配線する（contracts/availability-view.feature）。
// 予約作成・自分の予約・キャンセルは別スライス（今回は未実装）。
import AvailabilityScreen from "@/features/availability/AvailabilityScreen";

function App() {
  return <AvailabilityScreen />;
}

export default App
