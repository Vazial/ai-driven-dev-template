// RFE-A「会議室の空き状況を画面で確認できる」・RFE-B「空いている時間帯を予約できる」の本番画面。
//
// contracts/availability-view.feature（RFE-A-01/02/03）・contracts/reservation-booking.feature
// （RFE-B-01/02/03）を満たす対象。BookingDesign.tsx（src/design-preview/、承認済みモック）の
// タイムライン骨格（会議室ごとの横タイムライン・時間軸・開いた瞬間に一覧が見える）・予約ダイアログ骨格
// を保つ（meta/adr/0021、骨格の作り替えをしない。ダイアログ本体はBookingDialog.tsxに分離）。
//
// 適用した設計調整（reservation-frontend/adr/0006「案B」、design/reconciliation/
// booking-design-reconciliation.md 9節）:
//   - 予約者名は表示しない。予約バーは「空き」「予約済み（不可）」の二値状態表示にとどめる
//   - 会議室ごとの営業時間をタイムライン描画に反映する（reconciliation項目7）
//
// RFE-C「自分の予約を確認してキャンセルできる」スライスで「自分の予約」Sheet
// （src/features/my-reservations/MyReservationsSheet.tsx）をヘッダーに配線した。BookingDesign.tsx
// 骨格のヘッダー右側にあった予約者ID/表示名の入力欄は持たない（案Bの調整により、自分の予約は
// reserverIdによる絞り込みではなくこの端末の記録から組み立てるため。契約解釈ポイント(1)）。
import { useEffect, useMemo, useState } from "react";
import { addDays, format, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Toaster } from "@/components/ui/sonner";

import { listRooms } from "@/api/rooms";
import { getRoomAvailability } from "@/api/availability";
import type { ApiResult, AvailabilityResponse, AvailableTimeSlot, RoomSummary } from "@/api/types";
import { deriveUnavailableRanges, rangeToPercent, timeToMinutes } from "./timeGrid";
import BookingDialog, { type BookingSlot } from "@/features/booking/BookingDialog";
import MyReservationsSheet from "@/features/my-reservations/MyReservationsSheet";

const DEFAULT_AXIS_START = "09:00";
const DEFAULT_AXIS_END = "18:00";

type AvailabilityByRoom = Record<string, ApiResult<AvailabilityResponse> | undefined>;

function computeAxisRange(rooms: RoomSummary[]): { start: string; end: string } {
  if (rooms.length === 0) {
    return { start: DEFAULT_AXIS_START, end: DEFAULT_AXIS_END };
  }
  const start = rooms.reduce(
    (min, r) => (timeToMinutes(r.businessHoursStart) < timeToMinutes(min) ? r.businessHoursStart : min),
    rooms[0].businessHoursStart,
  );
  const end = rooms.reduce(
    (max, r) => (timeToMinutes(r.businessHoursEnd) > timeToMinutes(max) ? r.businessHoursEnd : max),
    rooms[0].businessHoursEnd,
  );
  return { start, end };
}

function hourMarks(axisStart: string, axisEnd: string): number[] {
  const startHour = Math.floor(timeToMinutes(axisStart) / 60);
  const endHour = Math.ceil(timeToMinutes(axisEnd) / 60);
  const marks: number[] = [];
  for (let h = startHour; h <= endHour; h++) marks.push(h);
  return marks;
}

export type AvailabilityScreenProps = {
  /** テスト・デモ用に表示日付を固定するためのオプション。省略時は今日 */
  initialDate?: Date;
};

export default function AvailabilityScreen({ initialDate }: AvailabilityScreenProps = {}) {
  const [currentDate, setCurrentDate] = useState<Date>(initialDate ?? new Date());
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [availabilityByRoom, setAvailabilityByRoom] = useState<AvailabilityByRoom>({});
  // listRooms()・getRoomAvailability() が失敗した(実APIモードでのネットワーク層の失敗等)場合の
  // 最小限の汎用失敗表示フラグ(ADR-0009 決定4)。ProblemResponseの型は使わない(契約が定義する
  // 構造化エラーではないため)。過剰なリトライ・凝ったUIは作らない(P-05)。roomsとavailabilityの
  // どちらの実fetchが落ちても同じ汎用表示に落とす(2本目の実接続=adr/0009 決定6(b))。
  const [loadFailed, setLoadFailed] = useState(false);

  // RFE-B: 予約ダイアログの状態。空き枠クリックで開き、会議室・日付・時間帯を引き継ぐ(RFE-B-01)
  const [bookingRoom, setBookingRoom] = useState<RoomSummary | null>(null);
  const [bookingSlot, setBookingSlot] = useState<BookingSlot | null>(null);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  // クリックのたびに増分し、BookingDialogをkeyとして再マウントしてフォーム状態をリセットする
  // (BookingDialog.tsxの注記参照。エフェクトでのリセットは行わない)
  const [bookingDialogKey, setBookingDialogKey] = useState(0);
  // 予約確定の試行(成功/拒否のいずれでも)のたびに増分し、空き状況の再取得を発火させる
  const [refreshTick, setRefreshTick] = useState(0);

  const formattedDate = format(currentDate, "yyyy-MM-dd");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let roomList: RoomSummary[];
      try {
        roomList = await listRooms();
      } catch {
        // ADR-0009 決定4: ネットワーク層の失敗はProblemResponseに押し込めず、ここでは
        // 最小限の汎用失敗表示に落とす(文言はP-05に沿って最小限に留める)。
        if (!cancelled) setLoadFailed(true);
        return;
      }
      if (cancelled) return;
      setLoadFailed(false);
      setRooms(roomList);

      try {
        const entries = await Promise.all(
          roomList.map(async (room) => {
            const result = await getRoomAvailability(room.roomId, formattedDate);
            return [room.roomId, result] as const;
          }),
        );
        if (cancelled) return;
        setAvailabilityByRoom(Object.fromEntries(entries));
      } catch {
        // ADR-0009 決定4(2本目=決定6(b)): availability実fetchのネットワーク層失敗(実モードで
        // バック未起動・接続不可等)も、契約のROOM_NOT_FOUND(404=ApiResultのok:false)とは別物と
        // して扱い、ProblemResponseに押し込めず汎用失敗表示に落とす。
        if (!cancelled) setLoadFailed(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // formattedDate は currentDate から一意に導出される値のため、依存配列は currentDate で足りる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, refreshTick]);

  const axis = useMemo(() => computeAxisRange(rooms), [rooms]);
  const marks = useMemo(() => hourMarks(axis.start, axis.end), [axis]);

  function handleSlotClick(room: RoomSummary, slot: AvailableTimeSlot) {
    // RFE-B-01: 空いている時間帯をクリックして予約ダイアログを開く
    setBookingRoom(room);
    setBookingSlot(slot);
    setIsBookingDialogOpen(true);
    setBookingDialogKey((k) => k + 1);
  }

  function handleBookingSettled() {
    setRefreshTick((t) => t + 1);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <Toaster />
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-blue-600">RoomReserve</h1>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="前の日"
              onClick={() => setCurrentDate((d) => subDays(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="px-4 font-medium">
                  {format(currentDate, "yyyy年MM月dd日 (eee)", { locale: ja })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={(d) => d && setCurrentDate(d)}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              aria-label="次の日"
              onClick={() => setCurrentDate((d) => addDays(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* RFE-C: 「自分の予約」Sheet。空き状況への反映(RFE-C-03の3つ目のThen)は、予約確定と同じ
            handleBookingSettled(refreshTickの増分)を再利用する */}
        <MyReservationsSheet
          rooms={rooms}
          refreshSignal={refreshTick}
          onReservationCancelled={handleBookingSettled}
        />
      </header>

      <main className="flex-1 overflow-auto p-6">
        <Card className="min-w-[800px] border-none shadow-sm">
          <div className="grid grid-cols-[200px_1fr] border-b bg-slate-50/50">
            <div className="p-4 font-semibold text-slate-500 text-sm">会議室</div>
            <div className="flex">
              {marks.map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-xs text-slate-400 py-2 border-l border-slate-200"
                >
                  {h}:00
                </div>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)]">
            {loadFailed && (
              // ADR-0009 決定4: 実fetch(rooms/availability)のネットワーク層失敗時の最小限の汎用
              // 失敗表示。ProblemResponse型は使わない(契約が定義する構造化エラーではないため)。
              <p role="alert" className="p-6 text-sm text-red-600">
                読み込みに失敗しました
              </p>
            )}
            {!loadFailed && rooms.length === 0 && (
              <p className="p-6 text-sm text-slate-500">会議室を読み込んでいます…</p>
            )}
            {!loadFailed && rooms.map((room) => (
              <RoomAvailabilityRow
                key={room.roomId}
                room={room}
                axisStart={axis.start}
                axisEnd={axis.end}
                result={availabilityByRoom[room.roomId]}
                onSlotClick={(slot) => handleSlotClick(room, slot)}
              />
            ))}
          </ScrollArea>
        </Card>
      </main>

      <BookingDialog
        key={bookingDialogKey}
        open={isBookingDialogOpen}
        onOpenChange={setIsBookingDialogOpen}
        room={bookingRoom}
        date={formattedDate}
        slot={bookingSlot}
        onSettled={handleBookingSettled}
      />
    </div>
  );
}

function RoomAvailabilityRow({
  room,
  axisStart,
  axisEnd,
  result,
  onSlotClick,
}: {
  room: RoomSummary;
  axisStart: string;
  axisEnd: string;
  result: ApiResult<AvailabilityResponse> | undefined;
  onSlotClick: (slot: AvailableTimeSlot) => void;
}) {
  return (
    <div
      data-testid={`room-row-${room.roomId}`}
      className="grid grid-cols-[200px_1fr] border-b last:border-b-0 min-h-[80px]"
    >
      <div className="p-4 bg-white flex flex-col justify-center border-r border-slate-100">
        <h3 className="font-bold text-slate-800">{room.name}</h3>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
          <Users className="h-3 w-3" /> 定員 {room.capacity}名
        </div>
      </div>

      <div className="relative flex bg-white items-center px-2 min-h-[80px]">
        {result === undefined && (
          <p className="text-sm text-slate-400">読み込み中…</p>
        )}

        {result && !result.ok && (
          // RFE-A-03: 存在しない会議室の空き状況は確認できず、理由が画面で分かる
          <p role="alert" className="text-sm text-red-600">
            {result.error.message}
          </p>
        )}

        {result && result.ok && result.data.availableSlots.length === 0 && (
          // RFE-A-02: 空いている時間帯がない場合も、その旨が画面で分かる
          <p className="text-sm text-slate-500">空いている時間帯はありません</p>
        )}

        {result && result.ok && result.data.availableSlots.length > 0 && (
          <div className="relative w-full h-10">
            {/* 「予約済み（不可）」区間。予約者名・占有詳細は出さない二値表現(ADR-0006 案B) */}
            {deriveUnavailableRanges(
              room.businessHoursStart,
              room.businessHoursEnd,
              result.data.availableSlots,
            ).map((slot, idx) => {
              const { left, width } = rangeToPercent(
                slot.startTime,
                slot.endTime,
                axisStart,
                axisEnd,
              );
              return (
                <div
                  key={`busy-${idx}`}
                  className="absolute top-1 bottom-1 rounded-md border bg-slate-100 border-slate-200 text-slate-500 text-xs flex items-center justify-center overflow-hidden px-1"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  予約済み（不可）
                </div>
              );
            })}

            {/* RFE-A-01: 空いている時間帯として明示的に表示される。
                RFE-B-01: クリックすると予約ダイアログが開く(会議室・日付・時間帯を引き継ぐ) */}
            {result.data.availableSlots.map((slot, idx) => {
              const { left, width } = rangeToPercent(
                slot.startTime,
                slot.endTime,
                axisStart,
                axisEnd,
              );
              return (
                <div
                  key={`free-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSlotClick(slot)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSlotClick(slot);
                  }}
                  className="absolute top-1 bottom-1 rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 text-xs flex items-center justify-center overflow-hidden px-1 cursor-pointer hover:bg-emerald-100"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  空き {slot.startTime}〜{slot.endTime}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
