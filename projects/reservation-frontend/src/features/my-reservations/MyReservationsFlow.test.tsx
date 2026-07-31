// 「自分の予約」Sheet(MyReservationsSheet)を含むAvailabilityScreen全体のbehaviorテスト。
//
// contracts/my-reservations.feature（RFE-C、スライスRFE-C）の受け入れシナリオRFE-C-01〜05を、
// モックAPI（@/api/rooms・@/api/availability・@/api/reservations）に対する画面の振る舞いとして
// 検証する。@/api/myReservationsStore（端末ローカルの記録、案B）はモックせず実際のlocalStorageを
// 使う——この記録の読み書き自体がRFE-Cの中心的な仕組みであり、モックすると検証の意味が薄れるため
// （myReservationsStore.test.tsは記録の読み書きロジック単体を検証する。ここでは画面との結線を見る）。
//
// テストの流儀はsrc/features/booking/BookingFlow.test.tsx（RFE-B）に倣う。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AvailabilityScreen from "@/features/availability/AvailabilityScreen";
import { listRooms } from "@/api/rooms";
import { getRoomAvailability } from "@/api/availability";
import { createReservation, cancelReservation } from "@/api/reservations";
import { recordMyReservation } from "@/api/myReservationsStore";

vi.mock("@/api/rooms", () => ({
  listRooms: vi.fn(),
}));
vi.mock("@/api/availability", () => ({
  getRoomAvailability: vi.fn(),
}));
vi.mock("@/api/reservations", () => ({
  createReservation: vi.fn(),
  cancelReservation: vi.fn(),
}));

const mockedListRooms = vi.mocked(listRooms);
const mockedGetRoomAvailability = vi.mocked(getRoomAvailability);
const mockedCreateReservation = vi.mocked(createReservation);
const mockedCancelReservation = vi.mocked(cancelReservation);

// contracts/my-reservations.feature の Background: 会議室"会議室A"(営業時間09:00〜18:00、定員6人)
const ROOM_A = {
  roomId: "room-a",
  name: "会議室A",
  businessHoursStart: "09:00",
  businessHoursEnd: "18:00",
  capacity: 6,
};

/** 「自分の予約」Sheetを開き、SheetContent(role="dialog")を返す */
async function openMyReservationsSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /自分の予約/ }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  mockedListRooms.mockReset();
  mockedGetRoomAvailability.mockReset();
  mockedCreateReservation.mockReset();
  mockedCancelReservation.mockReset();
  window.localStorage.clear();
});

describe("自分の予約(RFE-C)", () => {
  // RFE-C-01: この端末で行った予約が一覧に表示される
  it("この端末で行った予約が一覧に表示される", async () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
    });
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: { roomId: "room-a", date: "2026-07-14", availableSlots: [] },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    const sheet = await openMyReservationsSheet(user);
    expect(within(sheet).getByText("会議室A")).toBeInTheDocument();
    expect(within(sheet).getByText("2026-07-14")).toBeInTheDocument();
    expect(within(sheet).getByText("14:00 - 15:00")).toBeInTheDocument();
  });

  // RFE-C-02: この端末で予約を一度も行っていない場合、その旨が画面で分かる
  it("一度も予約していない場合、その旨が画面で分かる", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: { roomId: "room-a", date: "2026-07-14", availableSlots: [] },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    const sheet = await openMyReservationsSheet(user);
    expect(within(sheet).getByText("予約はありません")).toBeInTheDocument();
  });

  // RFE-C-03: 自分の予約をキャンセルする(一覧からも空き状況からも消える)
  it("自分の予約をキャンセルすると、一覧からも空き状況からも消える", async () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
    });
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability
      .mockResolvedValueOnce({
        ok: true,
        data: {
          roomId: "room-a",
          date: "2026-07-14",
          availableSlots: [
            { startTime: "09:00", endTime: "14:00" },
            { startTime: "15:00", endTime: "18:00" },
          ],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          roomId: "room-a",
          date: "2026-07-14",
          availableSlots: [{ startTime: "09:00", endTime: "18:00" }],
        },
      });
    mockedCancelReservation.mockResolvedValue({
      ok: true,
      data: {
        reservationId: "rsv-1",
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        startTime: "14:00",
        endTime: "15:00",
        attendeeCount: 2,
        cancelledAt: "2026-07-14T10:00:00+09:00",
      },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    const sheet = await openMyReservationsSheet(user);
    expect(within(sheet).getByText("14:00 - 15:00")).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "キャンセル" }));

    await waitFor(() => {
      // 4本目の実接続: cancelReservation は端末の記録から取り出した reserverId も渡す
      expect(mockedCancelReservation).toHaveBeenCalledWith("rsv-1", "sato");
    });

    // 予約がキャンセルされたことが画面で分かる/一覧からその予約が消える
    await waitFor(() => {
      expect(within(sheet).queryByText("14:00 - 15:00")).not.toBeInTheDocument();
    });
    expect(within(sheet).getByText("予約はありません")).toBeInTheDocument();

    // 3つ目のThen: 空き状況画面で"14:00"から"15:00"は再び空きになる
    await waitFor(() => {
      expect(screen.queryByText("空き 09:00〜14:00")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("空き 09:00〜18:00")).toBeInTheDocument();
  });

  // RFE-C-04: 開始直前になった予約をキャンセルしようとして拒否される
  it("開始直前になった予約をキャンセルしようとして拒否される", async () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "10:00",
      endTime: "11:00",
    });
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: { roomId: "room-a", date: "2026-07-14", availableSlots: [] },
    });
    mockedCancelReservation.mockResolvedValue({
      ok: false,
      error: {
        code: "CANCEL_DEADLINE_PASSED",
        message: "開始15分前を過ぎているためキャンセルできません",
      },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    const sheet = await openMyReservationsSheet(user);
    await user.click(within(sheet).getByRole("button", { name: "キャンセル" }));

    const alert = await within(sheet).findByRole("alert");
    expect(alert).toHaveTextContent("開始15分前を過ぎているためキャンセルできません");

    // 自分の予約の一覧にその予約が残ったままである
    expect(within(sheet).getByText("10:00 - 11:00")).toBeInTheDocument();
  });

  // RFE-C-05: 別の画面で既にキャンセル済みの予約を、一覧が更新されないままもう一度キャンセルしよう
  // として拒否される
  it("別の画面で既にキャンセル済みの予約を、もう一度キャンセルしようとして拒否される", async () => {
    recordMyReservation({
      reservationId: "rsv-1",
      roomId: "room-a",
      reserverId: "sato",
      date: "2026-07-14",
      startTime: "14:00",
      endTime: "15:00",
    });
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: { roomId: "room-a", date: "2026-07-14", availableSlots: [] },
    });
    mockedCancelReservation.mockResolvedValue({
      ok: false,
      error: { code: "ALREADY_CANCELLED", message: "この予約は既にキャンセルされています" },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    const sheet = await openMyReservationsSheet(user);
    await user.click(within(sheet).getByRole("button", { name: "キャンセル" }));

    const alert = await within(sheet).findByRole("alert");
    expect(alert).toHaveTextContent("この予約は既にキャンセルされています");
  });

  // 追加検証(既存シナリオ番号なし。RFE-B→RFE-Cの接続点): 予約が成立すると、この端末の記録に
  // 追加され、自分の予約一覧に表示される(RFE-C-01が成立するための前提)
  it("予約が成立すると、この端末の記録に追加され自分の予約一覧に表示される", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: {
        roomId: "room-a",
        date: "2026-07-14",
        availableSlots: [{ startTime: "09:00", endTime: "18:00" }],
      },
    });
    mockedCreateReservation.mockResolvedValue({
      ok: true,
      data: {
        reservationId: "rsv-9",
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        // BookingDialogの既定値(空き帯の開始09:00から60分)をそのまま使う
        startTime: "09:00",
        endTime: "10:00",
        attendeeCount: 4,
      },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    await user.click(await screen.findByText("空き 09:00〜18:00"));
    const bookingDialog = await screen.findByRole("dialog");
    await user.type(within(bookingDialog).getByLabelText("予約者ID"), "sato");
    await user.click(within(bookingDialog).getByRole("button", { name: "予約を確定する" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const sheet = await openMyReservationsSheet(user);
    expect(within(sheet).getByText("09:00 - 10:00")).toBeInTheDocument();
  });
});
