import React, { useState, useMemo } from 'react';
import { format, addMinutes, startOfDay, isBefore, subMinutes, parseISO, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Plus
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

// --- ダミーデータ・型定義 ---

type Reservation = {
  id: string;
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  capacity: number;
};

type Room = {
  id: string;
  name: string;
  capacity: number;
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
};

const MOCK_ROOMS: Room[] = [
  { id: 'room-1', name: '大会議室オーシャン', capacity: 20, openTime: '09:00', closeTime: '18:00' },
  { id: 'room-2', name: '集中ブースA', capacity: 1, openTime: '00:00', closeTime: '23:59' },
  { id: 'room-3', name: 'ミーティングスペースB', capacity: 6, openTime: '10:00', closeTime: '19:00' },
];

const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: 'res-1',
    roomId: 'room-1',
    roomName: '大会議室オーシャン',
    userId: 'user-123',
    userName: '自分',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '13:00',
    endTime: '14:30',
    capacity: 10,
  },
  {
    id: 'res-2',
    roomId: 'room-1',
    roomName: '大会議室オーシャン',
    userId: 'user-456',
    userName: '他の方',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    endTime: '11:00',
    capacity: 5,
  }
];

// --- メインコンポーネント ---

export default function ReservationApp() {
  const [activeTab, setActiveTab] = useState('book');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRoomId, setSelectedRoomId] = useState<string>(MOCK_ROOMS[0].id);
  const [currentUserId, setCurrentUserId] = useState('user-123'); // 便宜上の固定ID
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);

  const selectedRoom = MOCK_ROOMS.find(r => r.id === selectedRoomId) || MOCK_ROOMS[0];

  // 時間枠の生成 (30分刻み)
  const timeSlots = useMemo(() => {
    const slots = [];
    let current = parseISO(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedRoom.openTime}`);
    const end = parseISO(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedRoom.closeTime}`);

    while (isBefore(current, end)) {
      const timeStr = format(current, 'HH:mm');
      const reservation = reservations.find(r => 
        r.roomId === selectedRoomId && 
        r.date === format(selectedDate, 'yyyy-MM-dd') &&
        timeStr >= r.startTime && timeStr < r.endTime
      );
      slots.push({ time: timeStr, reservation });
      current = addMinutes(current, 30);
    }
    return slots;
  }, [selectedDate, selectedRoomId, reservations, selectedRoom]);

  // 予約実行
  const handleBooking = (startTime: string, durationMinutes: number) => {
    const endTime = format(addMinutes(parseISO(`2000-01-01T${startTime}`), durationMinutes), 'HH:mm');
    const newRes: Reservation = {
      id: `res-${Math.random().toString(36).substr(2, 9)}`,
      roomId: selectedRoomId,
      roomName: selectedRoom.name,
      userId: currentUserId,
      userName: '自分',
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime,
      endTime,
      capacity: selectedRoom.capacity
    };
    setReservations([...reservations, newRes]);
    toast.success('予約を完了しました');
  };

  // キャンセル実行
  const handleCancel = (resId: string) => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;

    // キャンセル期限チェック (15分前)
    const startTimeDate = parseISO(`${res.date}T${res.startTime}`);
    if (isBefore(subMinutes(startTimeDate, 15), new Date())) {
      toast.error('開始15分前を過ぎているためキャンセルできません');
      return;
    }

    setReservations(reservations.filter(r => r.id !== resId));
    toast.success('予約をキャンセルしました');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">会議室予約システム</h1>
        <div className="bg-muted/50 p-3 rounded-lg border text-sm text-muted-foreground flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">システム要件へのフィードバック:</p>
            <p>現在のAPI構成には「全会議室の取得」と「特定ユーザーの予約一覧取得」が含まれていません。本デモではモックデータを使用していますが、実運用にはこれらのエンドポイントの追加を推奨します。</p>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border">
        <div className="space-y-1 grow">
          <Label htmlFor="user-id">利用者名 (自己申告)</Label>
          <Input 
            id="user-id" 
            value={currentUserId} 
            onChange={(e) => setCurrentUserId(e.target.value)} 
            placeholder="ユーザーIDまたは名前を入力"
            className="max-w-[240px]"
          />
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">現在の設定</p>
          <Badge variant="outline">{currentUserId}</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="book">空き状況の確認・予約</TabsTrigger>
          <TabsTrigger value="my-reservations">自分の予約一覧</TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 会議室選択 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">1. 会議室を選択</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="会議室を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_ROOMS.map(room => (
                      <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>最大 {selectedRoom.capacity} 名</span>
                </div>
              </CardContent>
            </Card>

            {/* 日付選択 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">2. 日付を選択</CardTitle>
              </CardHeader>
              <CardContent>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, 'PPP', { locale: ja })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>

            {/* 凡例 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">凡例</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 bg-primary rounded-sm" /> 予約可能（30分〜）
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 bg-muted border rounded-sm" /> 予約済み / 営業時間外
                </div>
              </CardContent>
            </Card>
          </div>

          {/* タイムライン */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{format(selectedDate, 'M月d日(E)', { locale: ja })} の空き状況</span>
                <Badge variant="secondary">{selectedRoom.name}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {timeSlots.map((slot) => (
                  <div key={slot.time}>
                    {slot.reservation ? (
                      <Button
                        variant="ghost"
                        className="w-full h-16 flex flex-col items-center justify-center bg-muted/50 cursor-not-allowed opacity-60 border border-dashed"
                        disabled
                      >
                        <span className="text-xs font-bold">{slot.time}</span>
                        <span className="text-[10px] truncate w-full text-center">予約済</span>
                      </Button>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full h-16 flex flex-col items-center justify-center hover:bg-primary/10 hover:border-primary transition-all border-primary/20"
                          >
                            <span className="text-xs font-bold">{slot.time}</span>
                            <span className="text-[10px] text-primary">予約する</span>
                          </Button>
                        </DialogTrigger>
                        <BookingDialog 
                          room={selectedRoom} 
                          date={selectedDate} 
                          startTime={slot.time} 
                          onConfirm={handleBooking} 
                        />
                      </Dialog>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-reservations">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">あなたの予約一覧</h2>
            {reservations.filter(r => r.userId === currentUserId).length === 0 ? (
              <Card className="border-dashed py-12">
                <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
                  <Clock className="w-12 h-12 mb-4 opacity-20" />
                  <p>現在予約はありません</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {reservations
                  .filter(r => r.userId === currentUserId)
                  .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
                  .map(res => (
                    <Card key={res.id}>
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge>{res.roomName}</Badge>
                              {isSameDay(parseISO(res.date), new Date()) && (
                                <Badge variant="secondary">今日</Badge>
                              )}
                            </div>
                            <div className="text-2xl font-bold flex items-center gap-2">
                              {format(parseISO(res.date), 'M/d')} 
                              <span className="text-muted-foreground text-lg font-medium">
                                {res.startTime} - {res.endTime}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" /> {res.capacity}名
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4 text-green-500" /> 予約確定
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="gap-2">
                                  <Trash2 className="w-4 h-4" /> キャンセル
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>予約のキャンセル</DialogTitle>
                                  <DialogDescription>
                                    {res.roomName} の {res.date} {res.startTime}〜 の予約を取り消しますか？
                                    この操作は取り消せません。
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="ghost" onClick={() => {}}>戻る</Button>
                                  <Button variant="destructive" onClick={() => handleCancel(res.id)}>
                                    予約をキャンセルする
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- サブコンポーネント: 予約ダイアログ ---

function BookingDialog({ 
  room, 
  date, 
  startTime, 
  onConfirm 
}: { 
  room: Room, 
  date: Date, 
  startTime: string, 
  onConfirm: (start: string, duration: number) => void 
}) {
  const [duration, setDuration] = useState('60');

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>会議室を予約する</DialogTitle>
        <DialogDescription>
          {room.name} の予約詳細を確認してください。
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">日付</Label>
          <div className="col-span-3 text-sm font-medium">
            {format(date, 'yyyy年MM月dd日')}
          </div>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">開始時刻</Label>
          <div className="col-span-3 text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" /> {startTime}
          </div>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="duration" className="text-right">利用時間</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="col-span-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30分</SelectItem>
              <SelectItem value="60">1時間</SelectItem>
              <SelectItem value="90">1時間30分</SelectItem>
              <SelectItem value="120">2時間</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" onClick={() => onConfirm(startTime, parseInt(duration))}>
          予約を確定する
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
