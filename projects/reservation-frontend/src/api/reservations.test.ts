import { describe, it, expect } from "vitest";
import { createReservation } from "./reservations";

// モックAPI（createReservation）に対する単体テスト。
// contracts/reservation-booking.feature のRFE-B-02/03が要求するAPIレベルの応答形状を検証する
// （画面の振る舞いは src/features/booking の behavior テストで行う）。
// ドメインルール判定自体の網羅は src/api/reservationLogic.test.ts を参照（ここでは
// createReservation が判定結果を正しく反映し、成功時にMOCK_RESERVATIONSへ反映するかを確認する）。
describe("createReservation", () => {
  // RFE-B-02: 空いている時間帯を予約する
  it("空いている時間帯への予約は作成され、成功レスポンスを返す", async () => {
    const result = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-09-01",
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 4,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-09-01",
        startTime: "14:00",
        endTime: "15:00",
        attendeeCount: 4,
      });
      expect(result.data.reservationId).toBeTruthy();
    }
  });

  // RFE-B-03: 直前に他の予約者に埋まった時間帯を予約しようとして拒否される
  it("直前に他の予約者が埋めた時間帯への予約はTIME_SLOT_CONFLICTで拒否される", async () => {
    const date = "2026-09-02";

    const first = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date,
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 4,
    });
    expect(first.ok).toBe(true);

    const second = await createReservation({
      roomId: "room-a",
      reserverId: "suzuki",
      date,
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 2,
    });

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("TIME_SLOT_CONFLICT");
    }
  });

  it("存在しない会議室への予約はROOM_NOT_FOUNDで拒否される", async () => {
    const result = await createReservation({
      roomId: "存在しない会議室",
      reserverId: "sato",
      date: "2026-09-03",
      startTime: "14:00",
      endTime: "15:00",
      attendeeCount: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ROOM_NOT_FOUND");
    }
  });

  // RSV-C-05相当: ドメインルール違反(30分未満)もそのまま拒否理由として伝わる
  it("30分に満たない予約はTOO_SHORTで拒否される", async () => {
    const result = await createReservation({
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-09-04",
      startTime: "14:00",
      endTime: "14:15",
      attendeeCount: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOO_SHORT");
    }
  });
});
