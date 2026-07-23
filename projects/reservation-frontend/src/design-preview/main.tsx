/**
 * design-preview 専用の dev エントリ（本番エントリではない）。
 *
 * `design-preview.html`（プロジェクトルート）からのみ参照される。本番エントリ
 * `index.html` → `src/main.tsx` → `App.tsx` の配線には含まれない（import境界。
 * meta/adr/0022 §2）。`npm run build` の既定エントリは `index.html` のみのため、
 * このファイルおよび `src/design-preview/` 配下は本番バンドルに含まれない。
 *
 * 使い方: `npm run dev` を起動し、ブラウザ/curlで `/design-preview.html` を開く。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { DesignPreview } from './index'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignPreview />
  </StrictMode>,
)
