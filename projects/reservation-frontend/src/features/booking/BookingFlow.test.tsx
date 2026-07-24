// 予約フロー(AvailabilityScreen + BookingDialog)の behavior テスト。
//
// contracts/reservation-booking.feature（RFE-B、スライスRFE-B）の受け入れシナリオ
// RFE-B-01/02/03 を、モックAPI（@/api/rooms・@/api/availability・@/api/reservations）に対する
// 画面の振る舞いとして検証する。ドメインルールの判定自体（RSV-C）は src/api/reservationLogic.test.ts・
// src/api/reservations.test.ts で別途検証済み。ここでは、AvailabilityScreenが空き枠クリックから
// 確定までの流れを正しく仲介し、成功/拒否のそれぞれの応答を利用者に伝えるかだけを検証する
// （contracts/reservation-booking.feature 本文の意図と同じ）。
//
// 欠陥修正（人間レビュー）: 以前はクリックした空き帯の全体をそのまま予約していた（例:
// 09:00〜18:00の空き帯をクリックすると9時間まるごと予約されてしまう）。この修正に伴い、以下の
// テストは「会議室Aの営業時間全体(09:00〜18:00)にまたがる空き帯をクリックし、ダイアログ内で
// 開始/終了時刻を指定して予約する」形に更新した。これにより、指定した範囲だけが予約され、空き帯の
// 残りがタイムラインに空きとして残る（=分割反映される）ことを検証する。
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

// 会議室Aの営業時間全体が丸ごと空いている状態(欠陥の再現条件)
const WIDE_AVAILABLE_SLOT = { startTime: "09:00", endTime: "18:00" };

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** ダイアログ内のSelect(開始時刻/終了時刻)を開き、選択肢から値を選ぶ */
async function chooseTime(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  label: "開始時刻" | "終了時刻",
  value: string,
) {
  await user.click(within(dialog).getByLabelText(label));
  // Select の選択肢(SelectContent)はDialogとは別のPortalに描画されるため、document全体から探す
  await user.click(await screen.findByRole("option", { name: value }));
}

beforeEach(() => {
  mockedListRooms.mockReset();
  mockedGetRoomAvailability.mockReset();
  mockedCreateReservation.mockReset();
});

describe("予約フロー(RFE-B)", () => {
  // RFE-B-01: 空いている時間帯をクリックして予約ダイアログを開く
  it("空いている時間帯をクリックすると、会議室・日付・時間帯選択(空き帯の範囲内の既定値)を引き継いだ予約ダイアログが開く", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: {
        roomId: "room-a",
        date: "2026-07-14",
        availableSlots: [WIDE_AVAILABLE_SLOT],
      },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    const slot = await screen.findByText("空き 09:00〜18:00");
    await user.click(slot);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("会議室A")).toBeInTheDocument();
    expect(within(dialog).getByText("2026-07-14")).toBeInTheDocument();

    // 欠陥修正: 空き帯(09:00〜18:00)全体をそのまま予約対象にしない。既定値は
    // 空き帯の開始時刻(09:00)から60分(10:00)にとどまる
    const startTrigger = within(dialog).getByLabelText("開始時刻");
    const endTrigger = within(dialog).getByLabelText("終了時刻");
    expect(startTrigger).toHaveTextContent("09:00");
    expect(endTrigger).toHaveTextContent("10:00");
  });

  // 追加検証(既存シナリオ番号なし): 選択肢が空き帯の範囲内に収まり、30分刻みであること
  it("開始/終了時刻の選択肢は、クリックした空き帯の範囲内に限られ、30分刻みである", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: {
        roomId: "room-a",
        date: "2026-07-14",
        availableSlots: [WIDE_AVAILABLE_SLOT],
      },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    await user.click(await screen.findByText("空き 09:00〜18:00"));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByLabelText("開始時刻"));
    const startOptionTexts = (await screen.findAllByRole("option")).map((o) => o.textContent ?? "");
    expect(startOptionTexts[0]).toBe("09:00");
    // 空き帯の終了(18:00) - 最小予約時間(30分) = 17:30 が開始時刻の最後の選択肢
    expect(startOptionTexts[startOptionTexts.length - 1]).toBe("17:30");
    for (const t of startOptionTexts) {
      expect(toMinutes(t)).toBeGreaterThanOrEqual(toMinutes("09:00"));
      expect(toMinutes(t)).toBeLessThanOrEqual(toMinutes("17:30"));
    }
    for (let i = 1; i < startOptionTexts.length; i++) {
      expect(toMinutes(startOptionTexts[i]) - toMinutes(startOptionTexts[i - 1])).toBe(30);
    }
    // 既定の開始(09:00)を選び直して閉じる
    await user.click(await screen.findByRole("option", { name: "09:00" }));

    await user.click(within(dialog).getByLabelText("終了時刻"));
    const endOptionTexts = (await screen.findAllByRole("option")).map((o) => o.textContent ?? "");
    // 開始09:00からの最小予約時間(30分)後である09:30が最初の選択肢
    expect(endOptionTexts[0]).toBe("09:30");
    // 空き帯の終了時刻(18:00)まで選べる(空き帯を最後まで使い切れる)
    expect(endOptionTexts[endOptionTexts.length - 1]).toBe("18:00");
    for (let i = 1; i < endOptionTexts.length; i++) {
      expect(toMinutes(endOptionTexts[i]) - toMinutes(endOptionTexts[i - 1])).toBe(30);
    }
  });

  // RFE-B-02: 空いている時間帯を予約する
  it("空き帯の一部(14:00〜15:00)を指定して予約者IDと人数を入力して確定すると、予約が完了し指定した範囲だけがタイムラインに反映される", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability
      .mockResolvedValueOnce({
        ok: true,
        data: {
          roomId: "room-a",
          date: "2026-07-14",
          availableSlots: [WIDE_AVAILABLE_SLOT],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          roomId: "room-a",
          date: "2026-07-14",
          // 指定した範囲(14:00〜15:00)だけが埋まり、残りは空きのまま分割される
          availableSlots: [
            { startTime: "09:00", endTime: "14:00" },
            { startTime: "15:00", endTime: "18:00" },
          ],
        },
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

    await user.click(await screen.findByText("空き 09:00〜18:00"));
    const dialog = await screen.findByRole("dialog");

    await chooseTime(user, dialog, "開始時刻", "14:00");
    await chooseTime(user, dialog, "終了時刻", "15:00");

    await user.type(within(dialog).getByLabelText("予約者ID"), "sato");
    await user.clear(within(dialog).getByLabelText("参加人数"));
    await user.type(within(dialog).getByLabelText("参加人数"), "4");
    await user.click(within(dialog).getByRole("button", { name: "予約を確定する" }));

    await waitFor(() => {
      expect(mockedCreateReservation).toHaveBeenCalledWith({
        roomId: "room-a",
        reserverId: "sato",
        date: "2026-07-14",
        // 欠陥修正の核心: 空き帯全体(09:00〜18:00)ではなく、指定した範囲だけが送信される
        startTime: "14:00",
        endTime: "15:00",
        attendeeCount: 4,
      });
    });

    // 予約が完了したことが画面で分かる(ダイアログが閉じる)
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // 空き帯全体(09:00〜18:00)ではなく、指定した範囲(14:00〜15:00)だけが埋まる形で
    // タイムラインが分割反映される(09:00〜14:00 空き / 14:00〜15:00 予約済み(不可) / 15:00〜18:00 空き 相当)
    await waitFor(() => {
      expect(screen.queryByText("空き 09:00〜18:00")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("空き 09:00〜14:00")).toBeInTheDocument();
    expect(await screen.findByText("空き 15:00〜18:00")).toBeInTheDocument();
  });

  // RFE-B-03: 直前に他の予約者に埋まった時間帯を予約しようとして拒否される
  it("予約が拒否されると、拒否の理由が画面で分かり、指定した時間帯は予約済み(不可)のままである", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability
      .mockResolvedValueOnce({
        ok: true,
        data: {
          roomId: "room-a",
          date: "2026-07-14",
          availableSlots: [WIDE_AVAILABLE_SLOT],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          roomId: "room-a",
          date: "2026-07-14",
          // ダイアログを開いた後に別の予約者が14:00〜15:00を予約済みになった状態
          availableSlots: [
            { startTime: "09:00", endTime: "14:00" },
            { startTime: "15:00", endTime: "18:00" },
          ],
        },
      });
    mockedCreateReservation.mockResolvedValue({
      ok: false,
      error: { code: "TIME_SLOT_CONFLICT", message: "時間帯が既存の予約と重なっています" },
    });

    const user = userEvent.setup();
    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    await user.click(await screen.findByText("空き 09:00〜18:00"));
    const dialog = await screen.findByRole("dialog");

    await chooseTime(user, dialog, "開始時刻", "14:00");
    await chooseTime(user, dialog, "終了時刻", "15:00");

    await user.type(within(dialog).getByLabelText("予約者ID"), "suzuki");
    await user.clear(within(dialog).getByLabelText("参加人数"));
    await user.type(within(dialog).getByLabelText("参加人数"), "2");
    await user.click(within(dialog).getByRole("button", { name: "予約を確定する" }));

    // 拒否の理由が画面で分かる
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("時間帯が既存の予約と重なっています");

    // ダイアログはまだ開いたまま(確定できていない)
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // 空き状況画面で指定した時間帯(14:00〜15:00)は予約済み(不可)のままである
    await waitFor(() => {
      expect(screen.queryByText("空き 09:00〜18:00")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("空き 09:00〜14:00")).toBeInTheDocument();
    expect(await screen.findByText("空き 15:00〜18:00")).toBeInTheDocument();
  });
});
