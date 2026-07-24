import { describe, it, expect } from "vitest";
import { findReservationRejection } from "./reservationLogic";

// contracts/reservation-booking.feature（RFE-B）解釈ポイント(1): ドメインルールの正はRSV-C
// （projects/reservation-system/contracts/reservation-create.feature）が持つ。ここではモックAPIが
// RSV-Cの各シナリオの判定結果を正しく再現しているかを検証する（再定義ではなく再現の検証）。

// RSV-C Background: 会議室"会議室A"(営業時間09:00〜18:00、定員6人)
const ROOM_A = {
  roomId: "room-a",
  name: "会議室A",
  businessHoursStart: "09:00",
  businessHoursEnd: "18:00",
  capacity: 6,
};

describe("findReservationRejection", () => {
  // RSV-C-01相当: 空いている時間帯には予約を作成できる(拒否理由なし)
  it("ルールに反しない予約は拒否しない(null)", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "10:00",
        endTime: "11:00",
        attendeeCount: 4,
      },
      ROOM_A,
      [],
    );
    expect(result).toBeNull();
  });

  // RSV-C-02相当: 重なる時間帯には予約を作成できない
  it("既存予約と重なる時間帯はTIME_SLOT_CONFLICTで拒否する", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "suzuki",
        date: "2026-07-14",
        startTime: "10:30",
        endTime: "11:30",
        attendeeCount: 2,
      },
      ROOM_A,
      [{ startTime: "10:00", endTime: "11:00" }],
    );
    expect(result?.code).toBe("TIME_SLOT_CONFLICT");
  });

  // RSV-C-03相当: 直前の予約の終了時刻から始まる予約は作成できる(重なりではない)
  it("直前の予約の終了時刻ちょうどから始まる予約は拒否しない", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "suzuki",
        date: "2026-07-14",
        startTime: "11:00",
        endTime: "12:00",
        attendeeCount: 2,
      },
      ROOM_A,
      [{ startTime: "10:00", endTime: "11:00" }],
    );
    expect(result).toBeNull();
  });

  // RSV-C-05: 30分に満たない予約は作成できない
  it("30分に満たない予約はTOO_SHORTで拒否する", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "10:00",
        endTime: "10:15",
        attendeeCount: 2,
      },
      ROOM_A,
      [],
    );
    expect(result?.code).toBe("TOO_SHORT");
  });

  // RSV-C-06: 終了が開始より前の予約は作成できない
  it("終了が開始より前の予約はINVALID_TIME_SLOTで拒否する", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "11:00",
        endTime: "10:00",
        attendeeCount: 2,
      },
      ROOM_A,
      [],
    );
    expect(result?.code).toBe("INVALID_TIME_SLOT");
  });

  // RSV-C-07: 終了と開始が同時刻の予約は作成できない
  it("終了と開始が同時刻の予約はINVALID_TIME_SLOTで拒否する", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "10:00",
        endTime: "10:00",
        attendeeCount: 2,
      },
      ROOM_A,
      [],
    );
    expect(result?.code).toBe("INVALID_TIME_SLOT");
  });

  // RSV-C-08: 営業時間より前に始まる予約は作成できない
  it("営業時間より前に始まる予約はOUTSIDE_BUSINESS_HOURSで拒否する", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "08:00",
        endTime: "09:30",
        attendeeCount: 2,
      },
      ROOM_A,
      [],
    );
    expect(result?.code).toBe("OUTSIDE_BUSINESS_HOURS");
  });

  // RSV-C-09: 営業時間を超えて終わる予約は作成できない
  it("営業時間を超えて終わる予約はOUTSIDE_BUSINESS_HOURSで拒否する", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "17:30",
        endTime: "18:30",
        attendeeCount: 2,
      },
      ROOM_A,
      [],
    );
    expect(result?.code).toBe("OUTSIDE_BUSINESS_HOURS");
  });

  // RSV-C-10: 定員を超える人数の予約は作成できない
  it("定員を超える人数の予約はEXCEEDS_CAPACITYで拒否する", () => {
    const result = findReservationRejection(
      {
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "10:00",
        endTime: "11:00",
        attendeeCount: 7,
      },
      ROOM_A,
      [],
    );
    expect(result?.code).toBe("EXCEEDS_CAPACITY");
  });
});
