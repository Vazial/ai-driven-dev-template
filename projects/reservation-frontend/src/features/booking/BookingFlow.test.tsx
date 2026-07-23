// 予約フロー(AvailabilityScreen + BookingDialog)の behavior テスト。
//
// contracts/reservation-booking.feature（RFE-B、スライスRFE-B）の受け入れシナリオ
// RFE-B-01/02/03 を、モックAPI（@/api/rooms・@/api/availability・@/api/reservations）に対する
// 画面の振る舞いとして検証する。ドメインルールの判定自体（RSV-C）は src/api/reservationLogic.test.ts・
// src/api/reservations.test.ts で別途検証済み。ここでは、AvailabilityScreenが空き枠クリックから
// 確定までの流れを正しく仲介し、成功/拒否のそれぞれの応答を利用者に伝えるかだけを検証する
// （contracts/reservation-booking.feature 本文の意図と同じ）。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AvailabilityScreen from "@/features/availability/AvailabilityScreen";
import { listRooms } from "@/api/rooms";
import { getRoomAvailability } from "@/api/availability";
import { createReservation } from "@/api/reservations";

vi.mock("@/api/rooms", () => ({
  listRooms: vi.fn(),
}));
vi.mock("@/api/availability", () => ({
  getRoomAvailability: vi.fn(),
}));
vi.mock("@/api/reservations", () => ({
  createReservation: vi.fn(),
}));

const mockedListRooms = vi.mocked(listRooms);
const mockedGetRoomAvailability = vi.mocked(getRoomAvailability);
const mockedCreateReservation = vi.mocked(createReservation);

// contracts/reservation-booking.feature の Background: 会議室"会議室A"(営業時間09:00〜18:00、定員6人)
const ROOM_A = {
  roomId: "room-a",
  name: "会議室A",
  businessHoursStart: "09:00",
  businessHoursEnd: "18:00",
  capacity: 6,
};

beforeEach(() => {
  mockedListRooms.mockReset();
  mockedGetRoomAvailability.mockReset();
  mockedCreateReservation.mockReset();
});

describe("予約フロー(RFE-B)", () => {
  // RFE-B-01: 空いている時間帯をクリックして予約ダイアログを開く
  it("空いている時間帯をクリックすると、会議室・日付・時間帯を引き継いだ予約ダイアログが開く", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: {
        roomId: "room-a",
        date: "2026-07-14",
        availableSlots: [{ startTime: "14:00", endTime: "15:00" }],
      },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    const slot = await screen.findByText("空き 14:00〜15:00");
    await user.click(slot);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("会議室A")).toBeInTheDocument();
    expect(within(dialog).getByText("2026-07-14")).toBeInTheDocument();
    expect(within(dialog).getByText("14:00〜15:00")).toBeInTheDocument();
  });

  // RFE-B-02: 空いている時間帯を予約する
  it("予約者IDと人数を入力して確定すると、予約が完了しタイムラインに反映される", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability
      .mockResolvedValueOnce({
        ok: true,
        data: {
          roomId: "room-a",
          date: "2026-07-14",
          availableSlots: [{ startTime: "14:00", endTime: "15:00" }],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { roomId: "room-a", date: "2026-07-14", availableSlots: [] },
      });
    mockedCreateReservation.mockResolvedValue({
      ok: true,
      data: {
        reservationId: "rsv-1",
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "14:00",
        endTime: "15:00",
        attendeeCount: 4,
      },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    await user.click(await screen.findByText("空き 14:00〜15:00"));
    await user.type(screen.getByLabelText("予約者ID"), "sato");
    await user.clear(screen.getByLabelText("参加人数"));
    await user.type(screen.getByLabelText("参加人数"), "4");
    await user.click(screen.getByRole("button", { name: "予約を確定する" }));

    await waitFor(() => {
      expect(mockedCreateReservation).toHaveBeenCalledWith({
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "14:00",
        endTime: "15:00",
        attendeeCount: 4,
      });
    });

    // 予約が完了したことが画面で分かる(ダイアログが閉じる)
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // 空き状況画面で"14:00"から"15:00"は予約済み(不可)になる
    await waitFor(() => {
      expect(screen.queryByText("空き 14:00〜15:00")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("空いている時間帯はありません")).toBeInTheDocument();
  });

  // RFE-B-03: 直前に他の予約者に埋まった時間帯を予約しようとして拒否される
  it("予約が拒否されると、拒否の理由が画面で分かり、空き状況画面は予約済み(不可)のままである", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability
      .mockResolvedValueOnce({
        ok: true,
        data: {
          roomId: "room-a",
          date: "2026-07-14",
          availableSlots: [{ startTime: "14:00", endTime: "15:00" }],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { roomId: "room-a", date: "2026-07-14", availableSlots: [] },
      });
    mockedCreateReservation.mockResolvedValue({
      ok: false,
      error: { code: "TIME_SLOT_CONFLICT", message: "時間帯が既存の予約と重なっています" },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    await user.click(await screen.findByText("空き 14:00〜15:00"));
    await user.type(screen.getByLabelText("予約者ID"), "suzuki");
    await user.clear(screen.getByLabelText("参加人数"));
    await user.type(screen.getByLabelText("参加人数"), "2");
    await user.click(screen.getByRole("button", { name: "予約を確定する" }));

    // 拒否の理由が画面で分かる
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("時間帯が既存の予約と重なっています");

    // ダイアログはまだ開いたまま(確定できていない)
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // 空き状況画面で"14:00"から"15:00"は予約済み(不可)のままである
    await waitFor(() => {
      expect(screen.queryByText("空き 14:00〜15:00")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("空いている時間帯はありません")).toBeInTheDocument();
  });
});
