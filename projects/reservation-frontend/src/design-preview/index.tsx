/**
 * design-preview — 外部AI（designer役）が返すデザイン成果物の受け入れ口。
 *
 * 使い方（次にここへ成果物を置く人向け）:
 * 1. 外部AIが返したTSXコンポーネント一式を、このディレクトリ（src/design-preview/）に
 *    そのまま置く。ファイル名・ディレクトリ構成は成果物側に合わせて自由でよい。
 * 2. 成果物が `@/components/ui/...`（shadcn/uiのcopy-inコンポーネント）を import している
 *    前提で書かれていれば、このプロジェクトの `src/components/ui/` にすでに実体があるため、
 *    変更なしにそのまま解決される。
 * 3. 下の `DesignPreview` から、成果物のルートコンポーネントを描画する
 *    （App.tsx 側の呼び出し方は変えなくてよい）。
 *
 * 目的（なぜこの入り口があるか）:
 * デザイン成果物は「実プロジェクトでTSXとして描画」することで変容させずにレビューする
 * （静的HTMLへの手動書き直しをしない）。詳細は activeContext.md・meta/adr/0018・0019参照。
 *
 * 現在置かれている成果物:
 *   BookingDesign.tsx — ブリーフ design/briefs/room-booking-experience-brief.md に対して
 *   外部AI（Gemini）が返したもの（試行1・人間評価「原案としてOK」）。**無改変**。
 *   内蔵ダミーデータのみで動く。
 *
 * （再現性検証で単発実行の出力骨格に分散があることが分かっている。試行2の実ファイルは
 * 残していない。詳細は friction-log.md FR-004・activeContext.md）
 */
import { Toaster } from "@/components/ui/sonner"

import BookingApp from "./BookingDesign"

export function DesignPreview() {
  return (
    <>
      <BookingApp />
      {/* 成果物が sonner の toast を使うため、通知の描画先をここに置く */}
      <Toaster />
    </>
  )
}
