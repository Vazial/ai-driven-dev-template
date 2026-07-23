// モックデータ。実バックエンドは叩かない（RFE-Aスライス、meta/adr/0023「フロント先行・縦切り」）。
//
// 会議室A（room-a）は contracts/availability-view.feature の Background（営業時間09:00〜18:00、
// 定員6人）に合わせてある。日付ごとの予約データはRFE-A-01/02のシナリオが要求する状態
// （一部空き／終日埋まり）をそのまま再現できるように用意した。
import type { RoomSummary } from "./types";
import type { TimeRange } from "./availabilityLogic";

export const MOCK_ROOMS: RoomSummary[] = [
  {
    roomId: "room-a",
    name: "会議室A",
    businessHoursStart: "09:00",
    businessHoursEnd: "18:00",
    capacity: 6,
  },
  {
    roomId: "room-b",
    name: "会議室B",
    businessHoursStart: "08:00",
    businessHoursEnd: "20:00",
    capacity: 10,
  },
  {
    roomId: "room-c",
    name: "集中ブース",
    businessHoursStart: "08:00",
    businessHoursEnd: "22:00",
    capacity: 1,
  },
];

type MockReservation = TimeRange & { roomId: string; date: string };

export const MOCK_RESERVATIONS: MockReservation[] = [
  // RFE-A-01: "会議室A"に"10:00"から"11:00"までの予約が存在する
  { roomId: "room-a", date: "2026-07-14", startTime: "10:00", endTime: "11:00" },
  // RFE-A-02: "会議室A"に"09:00"から"18:00"までの予約が存在する（終日埋まり、別日で再現）
  { roomId: "room-a", date: "2026-07-15", startTime: "09:00", endTime: "18:00" },
  // 他の会議室にも参考データを持たせる（全部屋横断タイムラインの一望性を示すため）
  { roomId: "room-b", date: "2026-07-14", startTime: "13:00", endTime: "14:00" },
];
