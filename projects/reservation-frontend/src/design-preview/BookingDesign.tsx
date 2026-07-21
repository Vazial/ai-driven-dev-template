import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Users, 
  Plus, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Trash2,
  Info
} from 'lucide-react';
import { format, addDays, subDays, startOfDay, isAfter, subMinutes, parseISO, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';

// shadcn/ui components (Mocked imports)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Types & Dummy Data ---

type Room = {
  id: string;
  name: string;
  capacity: number;
  startHour: number;
  endHour: number;
};

type Reservation = {
  id: string;
  roomId: string;
  reserverId: string;
  reserverName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  attendeeCount: number;
};

const ROOMS: Room[] = [
  { id: 'room-a', name: '会議室A (大型)', capacity: 12, startHour: 9, endHour: 19 },
  { id: 'room-b', name: '会議室B (標準)', capacity: 6, startHour: 9, endHour: 18 },
  { id: 'room-c', name: '集中ブース', capacity: 1, startHour: 8, endHour: 20 },
];

const INITIAL_RESERVATIONS: Reservation[] = [
  { id: '1', roomId: 'room-a', reserverId: 'suzuki', reserverName: '鈴木', date: format(new Date(), 'yyyy-MM-dd'), startTime: '10:00', endTime: '11:30', attendeeCount: 8 },
  { id: '2', roomId: 'room-b', reserverId: 'sato', reserverName: '佐藤', date: format(new Date(), 'yyyy-MM-dd'), startTime: '13:00', endTime: '14:00', attendeeCount: 3 },
];

// --- Utilities ---

const generateTimeSlots = (start: number, end: number) => {
  const slots = [];
  for (let hour = start; hour < end; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:30`);
  }
  return slots;
};

// --- Main Component ---

export default function BookingApp() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [reserverId, setReserverId] = useState<string>("user-123"); // 実際はLocalStorage等から復元
  const [reserverName, setReserverName] = useState<string>("自分");
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{roomId: string, time: string} | null>(null);

  // フォーム用State
  const [formAttendees, setFormAttendees] = useState(2);

  const formattedDate = format(currentDate, 'yyyy-MM-dd');

  // 予約作成処理
  const handleBook = () => {
    if (!selectedSlot) return;
    
    // 簡易的な終了時間計算（開始+1時間）
    const [h, m] = selectedSlot.time.split(':').map(Number);
    const endH = m === 30 ? h + 1 : h;
    const endM = m === 30 ? "00" : "30";
    const endTime = `${String(endH).padStart(2, '0')}:${endM}`;

    const newRes: Reservation = {
      id: Math.random().toString(36).substr(2, 9),
      roomId: selectedSlot.roomId,
      reserverId,
      reserverName,
      date: formattedDate,
      startTime: selectedSlot.time,
      endTime,
      attendeeCount: formAttendees
    };

    setReservations([...reservations, newRes]);
    setIsBookingOpen(false);
    toast.success("予約を完了しました");
  };

  // キャンセル処理
  const handleCancel = (id: string) => {
    const res = reservations.find(r => r.id === id);
    if (!res) return;

    // ルールチェック: 開始15分前まで
    const startTimeDate = parseISO(`${res.date}T${res.startTime}`);
    if (!isAfter(startTimeDate, addMinutes(new Date(), 15))) {
      toast.error("開始15分前を過ぎているためキャンセルできません");
      return;
    }

    setReservations(reservations.filter(r => r.id !== id));
    toast.info("予約をキャンセルしました");
  };

  // 自分の予約一覧
  const myReservations = useMemo(() => 
    reservations.filter(r => r.reserverId === reserverId),
    [reservations, reserverId]
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-blue-600">RoomReserve</h1>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="px-4 font-medium">
                  {format(currentDate, 'yyyy年MM月dd日 (eee)', { locale: ja })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={currentDate} onSelect={(d) => d && setCurrentDate(d)} />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border">
            <User className="h-4 w-4 text-slate-500" />
            <input 
              className="bg-transparent text-sm font-medium focus:outline-none w-24"
              value={reserverName}
              onChange={(e) => setReserverName(e.target.value)}
              placeholder="表示名"
            />
            <span className="text-slate-300">|</span>
            <input 
              className="bg-transparent text-xs text-slate-500 focus:outline-none w-20"
              value={reserverId}
              onChange={(e) => setReserverId(e.target.value)}
              placeholder="ID"
            />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                自分の予約
                {myReservations.length > 0 && (
                  <Badge className="ml-2 bg-blue-500">{myReservations.length}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>自分の予約一覧</SheetTitle>
                <SheetDescription>キャンセルは開始15分前まで可能です</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {myReservations.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-10">予約はありません</p>
                )}
                {myReservations.map(res => (
                  <Card key={res.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold">{ROOMS.find(r => r.id === res.roomId)?.name}</div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleCancel(res.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-3 w-3" /> {res.date}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" /> {res.startTime} - {res.endTime}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Timeline Board */}
      <main className="flex-1 overflow-auto p-6">
        <Card className="min-w-[800px] border-none shadow-sm">
          <div className="grid grid-cols-[200px_1fr] border-b bg-slate-50/50">
            <div className="p-4 font-semibold text-slate-500 text-sm">会議室</div>
            <div className="flex">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex-1 text-center text-xs text-slate-400 py-2 border-l border-slate-200">
                  {i + 9}:00
                </div>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)]">
            {ROOMS.map(room => (
              <div key={room.id} className="grid grid-cols-[200px_1fr] border-b last:border-b-0 min-h-[100px] group">
                {/* Room Info */}
                <div className="p-4 bg-white flex flex-col justify-center border-r border-slate-100">
                  <h3 className="font-bold text-slate-800">{room.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <Users className="h-3 w-3" /> 定員 {room.capacity}名
                  </div>
                </div>

                {/* Slots Area */}
                <div className="relative flex bg-white">
                  {/* Grid Lines (30min intervals) */}
                  <div className="absolute inset-0 flex">
                    {generateTimeSlots(9, 21).map((slot, idx) => (
                      <div 
                        key={slot} 
                        className={`flex-1 border-l border-slate-50 ${idx % 2 === 0 ? 'border-l-slate-200' : ''}`}
                        onClick={() => {
                          setSelectedSlot({ roomId: room.id, time: slot });
                          setIsBookingOpen(true);
                        }}
                      >
                        <div className="h-full w-full hover:bg-blue-50/50 transition-colors cursor-pointer" />
                      </div>
                    ))}
                  </div>

                  {/* Reservations Bars */}
                  {reservations
                    .filter(res => res.roomId === room.id && res.date === formattedDate)
                    .map(res => {
                      // Calculate position based on 9:00 start, 30min slots
                      const [startH, startM] = res.startTime.split(':').map(Number);
                      const [endH, endM] = res.endTime.split(':').map(Number);
                      const startOffset = ((startH - 9) * 2) + (startM === 30 ? 1 : 0);
                      const durationSlots = ((endH - startH) * 2) + (endM === 30 ? 1 : 0) - (startM === 30 ? 1 : 0);
                      
                      const isMine = res.reserverId === reserverId;

                      return (
                        <div
                          key={res.id}
                          className={`absolute top-2 bottom-2 rounded-md shadow-sm border p-2 text-xs transition-all overflow-hidden z-[5] ${
                            isMine 
                              ? 'bg-blue-100 border-blue-300 text-blue-800' 
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                          style={{
                            left: `${(startOffset / 24) * 100}%`,
                            width: `${(durationSlots / 24) * 100}%`,
                          }}
                        >
                          <div className="font-bold truncate">{res.reserverName}</div>
                          <div className="opacity-80 truncate">{res.startTime}-{res.endTime}</div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            ))}
          </ScrollArea>
        </Card>
      </main>

      {/* Booking Dialog */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>会議室の予約</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4 text-sm">
              <Label className="text-right">会議室</Label>
              <div className="col-span-3 font-semibold">
                {ROOMS.find(r => r.id === selectedSlot?.roomId)?.name}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4 text-sm">
              <Label className="text-right">開始時刻</Label>
              <Badge variant="outline" className="w-fit col-span-3 text-base">
                {selectedSlot?.time}
              </Badge>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="attendees" className="text-right">参加人数</Label>
              <Input
                id="attendees"
                type="number"
                value={formAttendees}
                onChange={(e) => setFormAttendees(Number(e.target.value))}
                className="col-span-3"
              />
            </div>
            <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-lg text-xs text-blue-700 leading-relaxed">
              <Info className="h-4 w-4 shrink-0" />
              <div>
                現在はクイック予約モードです。デフォルトで60分確保されます。
                予約完了後、マイ予約から時間を調整・キャンセル可能です。
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBookingOpen(false)}>キャンセル</Button>
            <Button onClick={handleBook}>予約を確定する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ヘルパー: 分の加算 (Dateオブジェクトの処理が面倒なため簡易実装)
function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}
