// AvailabilityScreen の behavior テスト。
//
// contracts/availability-view.feature（RFE-A、スライスRFE-A）の受け入れシナリオを、モックAPI
// （@/api/rooms・@/api/availability）に対する画面の振る舞いとして検証する。
//
// 注記: この検証アプローチ（Vitest + React Testing Libraryによるcomponent/behaviorテスト）は
// RFE-Aスライスで初めて立てた最小構成である。本格的な受け入れテスト基盤（Cucumber等でシナリオ本文
// そのものを実行する形）やL5（VRT）の採否はここでは決めていない。後で正式化されうる
// （meta/verification.md参照）。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AvailabilityScreen from "./AvailabilityScreen";
import { listRooms } from "@/api/rooms";
import { getRoomAvailability } from "@/api/availability";

vi.mock("@/api/rooms", () => ({
  listRooms: vi.fn(),
}));
vi.mock("@/api/availability", () => ({
  getRoomAvailability: vi.fn(),
}));

const mockedListRooms = vi.mocked(listRooms);
const mockedGetRoomAvailability = vi.mocked(getRoomAvailability);

// contracts/availability-view.feature の Background: 会議室"会議室A"(営業時間09:00〜18:00、定員6人)
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
});

describe("AvailabilityScreen", () => {
  // RFE-A-01: 一部の時間帯に予約がある会議室の空き状況を確認する
  it("空いている時間帯が画面に表示される(一部空き)", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: {
        roomId: "room-a",
        date: "2026-07-14",
        availableSlots: [
          { startTime: "09:00", endTime: "10:00" },
          { startTime: "11:00", endTime: "18:00" },
        ],
      },
    });

    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    await waitFor(() => {
      expect(mockedGetRoomAvailability).toHaveBeenCalledWith("room-a", "2026-07-14");
    });

    expect(await screen.findByText("空き 09:00〜10:00")).toBeInTheDocument();
    expect(await screen.findByText("空き 11:00〜18:00")).toBeInTheDocument();
  });

  // RFE-A-02: 終日埋まっている会議室の空き状況を確認する
  it("空いている時間帯がないことが画面で分かる(終日埋まり)", async () => {
    mockedListRooms.mockResolvedValue([ROOM_A]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: true,
      data: { roomId: "room-a", date: "2026-07-14", availableSlots: [] },
    });

    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    expect(await screen.findByText("空いている時間帯はありません")).toBeInTheDocument();
  });

  // RFE-A-03: 存在しない会議室の空き状況を確認しようとする
  it("会議室が存在しないことを伝える案内が画面に表示される", async () => {
    mockedListRooms.mockResolvedValue([
      { ...ROOM_A, roomId: "存在しない会議室", name: "存在しない会議室" },
    ]);
    mockedGetRoomAvailability.mockResolvedValue({
      ok: false,
      error: { code: "ROOM_NOT_FOUND", message: "会議室が存在しません" },
    });

    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("会議室が存在しません");
  });

  it("会議室ごとの営業時間が時間軸に反映される(reconciliation項目7)", async () => {
    const roomWithDifferentHours = {
      roomId: "room-b",
      name: "会議室B",
      businessHoursStart: "08:00",
      businessHoursEnd: "20:00",
      capacity: 10,
    };
    mockedListRooms.mockResolvedValue([ROOM_A, roomWithDifferentHours]);
    mockedGetRoomAvailability.mockImplementation(async (roomId, date) => ({
      ok: true,
      data: { roomId, date, availableSlots: [] },
    }));

    render(<AvailabilityScreen initialDate={new Date("2026-07-14T00:00:00")} />);

    // 時間軸は全会議室の営業時間の和集合(08:00〜20:00)をカバーする
    expect(await screen.findByText("8:00")).toBeInTheDocument();
    expect(await screen.findByText("20:00")).toBeInTheDocument();
  });
});
