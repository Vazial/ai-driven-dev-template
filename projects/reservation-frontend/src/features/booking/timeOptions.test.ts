import { describe, it, expect } from "vitest";
import {
  generateStartTimeOptions,
  generateEndTimeOptions,
  computeDefaultEndTime,
  computeDefaultTimeRange,
} from "./timeOptions";

// Background: 会議室"会議室A"(営業時間"09:00"〜"18:00")の空き帯全体をそのままクリックしたケース
// (人間レビューで見つかった欠陥の再現条件)。
const WIDE_SLOT = { startTime: "09:00", endTime: "18:00" };

describe("generateStartTimeOptions", () => {
  it("空き帯の範囲内で30分刻みの開始時刻を返す(最後は終了時刻-30分まで)", () => {
    const options = generateStartTimeOptions(WIDE_SLOT);
    expect(options[0]).toBe("09:00");
    expect(options[options.length - 1]).toBe("17:30");
    // 09:00〜17:30、30分刻み(18個)
    expect(options).toHaveLength(18);
    // すべて空き帯の範囲内(開始 <= 17:30)であること
    for (const t of options) {
      expect(t >= "09:00" && t <= "17:30").toBe(true);
    }
  });

  it("30分ちょうどの空き帯では、開始時刻の選択肢は1つだけになる(最小予約時間ルールRSV-C-05に整合)", () => {
    const options = generateStartTimeOptions({ startTime: "14:00", endTime: "14:30" });
    expect(options).toEqual(["14:00"]);
  });
});

describe("generateEndTimeOptions", () => {
  it("選んだ開始時刻から、空き帯の終了時刻までを30分刻みで返す", () => {
    const options = generateEndTimeOptions(WIDE_SLOT, "14:00");
    expect(options).toEqual([
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
      "17:30",
      "18:00",
    ]);
    // 空き帯の終了時刻(18:00)まで選べる(空き帯を最後まで使い切れる)
    expect(options[options.length - 1]).toBe(WIDE_SLOT.endTime);
  });

  it("空き帯が刻みに乗らない終了時刻を持つ場合でも、空き帯の終了時刻を選択肢に含める", () => {
    const oddSlot = { startTime: "09:00", endTime: "09:40" };
    const options = generateEndTimeOptions(oddSlot, "09:00");
    // 30分刻みの09:30に加えて、空き帯の終了時刻(09:40)自体も選べる
    expect(options).toEqual(["09:30", "09:40"]);
  });
});

describe("computeDefaultEndTime", () => {
  it("空き帯に60分以上残っていれば、開始時刻+60分を既定にする", () => {
    expect(computeDefaultEndTime(WIDE_SLOT, "14:00")).toBe("15:00");
  });

  it("空き帯の残りが60分未満なら、空き帯の終了時刻を既定にする", () => {
    expect(computeDefaultEndTime({ startTime: "14:00", endTime: "14:30" }, "14:00")).toBe("14:30");
  });
});

describe("computeDefaultTimeRange", () => {
  it("空き帯全体(09:00〜18:00)をクリックしても、既定では60分だけを予約対象にする(欠陥の再現条件)", () => {
    const range = computeDefaultTimeRange(WIDE_SLOT);
    expect(range).toEqual({ startTime: "09:00", endTime: "10:00" });
    // 空き帯全体(9時間)をまるごと予約しないことを明示的に確認する
    expect(range.endTime).not.toBe(WIDE_SLOT.endTime);
  });

  it("空き帯が60分未満の場合は、空き帯の終了時刻までを既定にする", () => {
    const range = computeDefaultTimeRange({ startTime: "14:00", endTime: "14:30" });
    expect(range).toEqual({ startTime: "14:00", endTime: "14:30" });
  });
});
