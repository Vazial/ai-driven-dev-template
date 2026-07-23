import { describe, it, expect } from "vitest";
import { subtractRanges } from "./availabilityLogic";

// 単体テスト。reservation-system/contracts/reservation-availability.feature（RSV-A、承認済み）と
// 同じ意味論（半開区間・隣接区間の融合）をモックAPI内部で再現できているかを検証する。
// バックエンドの計算ロジックそのものを再検証するものではない（このモック実装専用のテスト）。
describe("subtractRanges", () => {
  it("予約が一つもない場合は営業時間全体が空きになる", () => {
    expect(subtractRanges("09:00", "18:00", [])).toEqual([
      { startTime: "09:00", endTime: "18:00" },
    ]);
  });

  it("一部の時間帯に予約がある場合、その前後が空きになる", () => {
    expect(
      subtractRanges("09:00", "18:00", [{ startTime: "10:00", endTime: "11:00" }]),
    ).toEqual([
      { startTime: "09:00", endTime: "10:00" },
      { startTime: "11:00", endTime: "18:00" },
    ]);
  });

  it("隙間なく隣り合う予約の間には空き時間帯が生まれない", () => {
    expect(
      subtractRanges("09:00", "18:00", [
        { startTime: "10:00", endTime: "11:00" },
        { startTime: "11:00", endTime: "12:00" },
      ]),
    ).toEqual([
      { startTime: "09:00", endTime: "10:00" },
      { startTime: "12:00", endTime: "18:00" },
    ]);
  });

  it("営業時間の全てに予約がある場合は空き時間帯が一つもない", () => {
    expect(
      subtractRanges("09:00", "18:00", [{ startTime: "09:00", endTime: "18:00" }]),
    ).toEqual([]);
  });
});
