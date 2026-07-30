// モックデータ。実バックエンドは叩かない（RFE-A/RFE-Bスライス、meta/adr/0023「フロント先行・縦切り」）。
//
// 会議室A（room-a）は contracts/availability-view.feature の Background（営業時間09:00〜18:00、
// 定員6人）に合わせてある。日付ごとの予約データはRFE-A-01/02のシナリオが要求する状態
// （一部空き／終日埋まり）をそのまま再現できるように用意した。
//
// MOCK_RESERVATIONS はRFE-Bスライス（src/api/reservations.ts の createReservation）が予約成立時に
// push する、モックAPI内の唯一の「予約台帳」でもある。getRoomAvailability（RFE-A）はこの配列から
// 空き時間帯を再計算するため、予約作成の成否がそのままタイムライン表示に反映される。
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

export type MockReservation = TimeRange & {
  reservationId: string;
  roomId: string;
  date: string;
  /** 予約者ID（自己申告、案B。ADR-0006により画面には表示しない） */
  reserverId: string;
  attendeeCount: number;
  /**
   * キャンセルされた日時（RFE-Kのcancelledベース、RFE-C「自分の予約を確認してキャンセルできる」が
   * 追加）。undefined/nullはキャンセルされていない予約。キャンセルされた予約はMOCK_RESERVATIONSから
   * 物理削除しない——getRoomAvailability（RFE-A/availability.ts）が「キャンセルされていない予約」
   * だけを占有として扱い、この時間帯を空きに戻す（RFE-C-03）。
   */
  cancelledAt?: string | null;
};

export const MOCK_RESERVATIONS: MockReservation[] = [
  // RFE-A-01: "会議室A"に"10:00"から"11:00"までの予約が存在する
  {
    reservationId: "seed-1",
    roomId: "room-a",
    date: "2026-07-14",
    startTime: "10:00",
    endTime: "11:00",
    reserverId: "seed-user",
    attendeeCount: 2,
  },
  // RFE-A-02: "会議室A"に"09:00"から"18:00"までの予約が存在する（終日埋まり、別日で再現）
  {
    reservationId: "seed-2",
    roomId: "room-a",
    date: "2026-07-15",
    startTime: "09:00",
    endTime: "18:00",
    reserverId: "seed-user",
    attendeeCount: 4,
  },
  // 他の会議室にも参考データを持たせる（全部屋横断タイムラインの一望性を示すため）
  {
    reservationId: "seed-3",
    roomId: "room-b",
    date: "2026-07-14",
    startTime: "13:00",
    endTime: "14:00",
    reserverId: "seed-user",
    attendeeCount: 2,
  },
];
