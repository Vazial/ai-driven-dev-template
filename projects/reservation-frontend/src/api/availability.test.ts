import { describe, it, expect } from "vitest";
import { getRoomAvailability } from "./availability";

// モックAPI（getRoomAvailability）に対する単体テスト。
// contracts/availability-view.feature のRFE-A-01/02/03が要求するAPIレベルの応答形状を検証する
// （画面表示の検証は src/features/availability の behavior テストで行う）。
describe("getRoomAvailability", () => {
  // RFE-A-01
  it("一部の時間帯に予約がある会議室は、空いている時間帯を返す", async () => {
    const result = await getRoomAvailability("room-a", "2026-07-14");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.availableSlots).toEqual([
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "11:00", endTime: "18:00" },
      ]);
    }
  });

  // RFE-A-02
  it("終日埋まっている会議室は、空いている時間帯が無い(空配列)ことを返す", async () => {
    const result = await getRoomAvailability("room-a", "2026-07-15");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.availableSlots).toEqual([]);
    }
  });

  // RFE-A-03
  it("存在しない会議室はROOM_NOT_FOUNDで拒否される", async () => {
    const result = await getRoomAvailability("存在しない会議室", "2026-07-14");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ROOM_NOT_FOUND");
    }
  });
});
