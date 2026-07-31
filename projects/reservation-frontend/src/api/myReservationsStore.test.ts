import { describe, it, expect, beforeEach } from "vitest";
import {
  recordMyReservation,
  listMyReservations,
  markMyReservationCancelled,
} from "./myReservationsStore";

// contracts/my-reservations.feature（RFE-C）解釈ポイント(1)(3-2)を対象とする、端末ローカル記録
// (localStorage)の単体テスト。画面の振る舞いは src/features/my-reservations の behavior テストで扱う。
describe("myReservationsStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("記録が無ければ一覧は空になる(RFE-C-02相当)", () => {
    expect(listMyReservations()).toEqual([]);
  });

  it("recordMyReservationで追加した予約が一覧に現れる(RFE-C-01相当)", () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
    });

    const list = listMyReservations();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
      status: "active",
    });
  });

  // 4本目の実接続（キャンセルの実バックエンド接続）: cancelReservation の実モードは reserverId を
  // リクエストボディの必須項目として要求するため、端末の記録から取り出せなければならない
  // （src/api/myReservationsStore.ts の注記・src/api/reservations.ts postRealCancelReservation）
  it("記録された reserverId は listMyReservations が返す一覧からそのまま取り出せる(キャンセル要求に使う)", () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "user-sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
    });

    expect(listMyReservations()[0].reserverId).toBe("user-sato");
  });

  // 解釈ポイント(3-2): キャンセル成功後も端末の記録は削除しない(論理削除)。ただし一覧には表示しない
  it("markMyReservationCancelledした予約は一覧から消えるが、記録自体は物理削除されない(論理削除)", () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
    });

    markMyReservationCancelled("rsv-1");

    // 一覧(表示用)には現れない
    expect(listMyReservations()).toEqual([]);

    // 記録そのものはlocalStorageから消えていない(物理削除しない)
    const raw = window.localStorage.getItem("reservation-frontend:my-reservations");
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ reservationId: "rsv-1", status: "cancelled" });
  });

  it("複数の予約のうち、キャンセルされていないものだけが一覧に残る", () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
    });
    recordMyReservation({
      reservationId: "rsv-2",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-15",
      startTime: "10:00",
      endTime: "11:00",
    });

    markMyReservationCancelled("rsv-1");

    const list = listMyReservations();
    expect(list).toHaveLength(1);
    expect(list[0].reservationId).toBe("rsv-2");
  });

  it("存在しない予約IDのキャンセル操作は何も起きない(例外を投げない)", () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
    });

    expect(() => markMyReservationCancelled("does-not-exist")).not.toThrow();
    expect(listMyReservations()).toHaveLength(1);
  });
});
