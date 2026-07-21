import { DesignPreview } from "@/design-preview"

// App.tsx はデザイン成果物の受け入れ口（src/design-preview/）をそのまま描画する。
// 契約スライスの実装が始まったら、ここをルーティング（画面遷移）に置き換える。
function App() {
  return <DesignPreview />
}

export default App
