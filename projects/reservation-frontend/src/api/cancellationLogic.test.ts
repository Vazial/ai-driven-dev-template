import { describe, it, expect } from "vitest";
import { findCancellationRejection } from "./cancellationLogic";

// contracts/my-reservations.feature（RFE-C）解釈ポイント(2)(3): このスライスが対象とする拒否理由は
// CANCEL_DEADLINE_PASSEDとALREADY_CANCELLEDのみ。ドメインルールの正は
// projects/reservation-system/contracts/reservation-cancel.feature（RSV-K）が持つ。ここではモックAPIが
// RSV-Kの各シナリオの判定結果を正しく再現しているかを検証する。

// RSV-K Background/Given: "会議室A"に予約者"佐藤"の"10:00"から"11:00"までの予約が存在する
const RESERVATION = { date: "2026-07-14", startTime: "10:00" };

describe("findCancellationRejection", () => {
  // RSV-K-04: 開始16分前のキャンセルは可能
  it("開始16分前は拒否しない(null)", () => {
    const result = findCancellationRejection(
      RESERVATION,
      new Date("2026-07-14T09:44:00"),
    );
    expect(result).toBeNull();
  });

  // RSV-K-05: 開始15分前ちょうどのキャンセルは可能(人間裁定: 15分前ちょうどは可)
  it("開始15分前ちょうどは拒否しない(null)", () => {
    const result = findCancellationRejection(
      RESERVATION,
      new Date("2026-07-14T09:45:00"),
    );
    expect(result).toBeNull();
  });

  // RSV-K-06: 開始14分前はキャンセル不可に転じる
  it("開始14分前はCANCEL_DEADLINE_PASSEDで拒否する", () => {
    const result = findCancellationRejection(
      RESERVATION,
      new Date("2026-07-14T09:46:00"),
    );
    expect(result?.code).toBe("CANCEL_DEADLINE_PASSED");
  });

  // RSV-K-07 / RFE-C-04: 開始後も同じ理由で拒否される(このスライスのGiven「現在時刻は"10:15"である」と同一)
  it("開始後(10:15)もCANCEL_DEADLINE_PASSEDで拒否する", () => {
    const result = findCancellationRejection(
      RESERVATION,
      new Date("2026-07-14T10:15:00"),
    );
    expect(result?.code).toBe("CANCEL_DEADLINE_PASSED");
  });

  // RSV-K-08 / RFE-C-05: 既にキャンセルされている予約は、期限内であっても再びキャンセルできない
  it("既にキャンセル済みの予約は、期限内でもALREADY_CANCELLEDで拒否する", () => {
    const result = findCancellationRejection(
      { ...RESERVATION, cancelledAt: "2026-07-14T09:00:00+09:00" },
      new Date("2026-07-14T09:10:00"),
    );
    expect(result?.code).toBe("ALREADY_CANCELLED");
  });

  // 判定順序の確認: 二重キャンセルは期限切れより優先される(既にキャンセルされている以上、
  // 期限判定自体が意味を持たない)
  it("既にキャンセル済み、かつ期限も過ぎている場合もALREADY_CANCELLEDになる", () => {
    const result = findCancellationRejection(
      { ...RESERVATION, cancelledAt: "2026-07-14T09:00:00+09:00" },
      new Date("2026-07-14T10:15:00"),
    );
    expect(result?.code).toBe("ALREADY_CANCELLED");
  });
});
