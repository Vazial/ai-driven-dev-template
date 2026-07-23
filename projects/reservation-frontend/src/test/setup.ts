// Vitest + React Testing Library の最小セットアップ。
// jest-dom のカスタムマッチャ（toBeInTheDocument 等）を各テストで使えるようにする。
//
// 注記: このプロジェクトの検証アプローチ（Vitest + RTL によるコンポーネント/behavior テスト）は、
// RFE-A実装スライスで初めて立てた最小構成である。本格的な受け入れテスト基盤（Cucumber等）や
// L5（VRT）の要否・採用はここでは決めていない。後で正式化されうる。
import "@testing-library/jest-dom/vitest";
