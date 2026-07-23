import { describe, it, expect } from "vitest";
import { rangeToPercent, timeToMinutes, deriveUnavailableRanges } from "./timeGrid";

describe("timeToMinutes", () => {
  it("HH:mmを分に変換する", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("18:30")).toBe(1110);
  });
});

describe("rangeToPercent", () => {
  it("軸の中央半分を占める区間は left=25, width=50 になる", () => {
    expect(rangeToPercent("10:00", "14:00", "08:00", "16:00")).toEqual({
      left: 25,
      width: 50,
    });
  });
});

describe("deriveUnavailableRanges", () => {
  it("空き時間帯の補集合として「不可」区間を導出する(案B・ADR-0006)", () => {
    const unavailable = deriveUnavailableRanges("09:00", "18:00", [
      { startTime: "09:00", endTime: "10:00" },
      { startTime: "11:00", endTime: "18:00" },
    ]);
    expect(unavailable).toEqual([{ startTime: "10:00", endTime: "11:00" }]);
  });

  it("空き時間帯が無い(終日埋まり)場合、営業時間全体が不可になる", () => {
    const unavailable = deriveUnavailableRanges("09:00", "18:00", []);
    expect(unavailable).toEqual([{ startTime: "09:00", endTime: "18:00" }]);
  });
});
