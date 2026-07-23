// Vitest + React Testing Library の最小セットアップ。
// jest-dom のカスタムマッチャ（toBeInTheDocument 等）を各テストで使えるようにする。
//
// 注記: このプロジェクトの検証アプローチ（Vitest + RTL によるコンポーネント/behavior テスト）は、
// RFE-A実装スライスで初めて立てた最小構成である。本格的な受け入れテスト基盤（Cucumber等）や
// L5（VRT）の要否・採用はここでは決めていない。後で正式化されうる。
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// このプロジェクトはVitestのglobals(test.globals)を有効化していないため、
// @testing-library/reactの自動クリーンアップ（afterEachの暗黙検出）が効かない。
// 同一テストファイル内で複数のDialogを開閉するテスト（RFE-Bの予約フロー等）が、前のテストの
// アンマウント漏れ（Radixのbody scroll lock等）を次のテストに持ち越さないよう、明示的に登録する。
afterEach(() => {
  cleanup();
});

// jsdom は window.matchMedia を実装していない。sonner（Toaster、RFE-Bスライスで新規導入）が
// マウント時に呼ぶため、テスト環境向けの最小スタブを用意する（実際のメディアクエリ判定は不要）。
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// jsdom は ResizeObserver を実装していない。radix-ui の ScrollArea（RFE-Aから使用）が
// レイアウトエフェクトで参照するため、テスト環境向けの最小スタブを用意する。
if (typeof window !== "undefined" && !window.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom は Pointer Capture 系のAPI・scrollIntoView を実装していない。radix-ui の Select
// （欠陥修正で新規導入、BookingDialog.tsxの開始/終了時刻選択）がトリガー・項目の
// ポインタ操作でこれらを参照するため、テスト環境向けの最小スタブを用意する。
if (typeof window !== "undefined" && typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
