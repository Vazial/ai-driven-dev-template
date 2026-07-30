// RFE-C「自分の予約を確認してキャンセルできる」の「自分の予約」Sheet。
//
// contracts/my-reservations.feature（RFE-C-01〜05）を満たす対象。BookingDesign.tsx
// （src/design-preview/、承認済みモック）の「自分の予約」Sheet骨格
// （SheetTrigger「自分の予約」ボタン＋件数バッジ → SheetContent「自分の予約一覧」、各予約を
// Cardで表示しキャンセル操作を持つ、SheetDescription「キャンセルは開始15分前まで可能です」）を保つ
// （meta/adr/0021、骨格の作り替えをしない）。
//
// 適用した設計調整（reservation-frontend/adr/0006「案B」）:
//   - 一覧はreserverIdによる絞り込みではなく、この端末の記録(src/api/myReservationsStore.ts)から
//     組み立てる（契約解釈ポイント(1)）。ヘッダーの予約者ID/表示名入力欄は持たない
//     （AvailabilityScreen.tsxが既にRFE-B側で同様の調整を適用済み）
//   - 予約者名は表示しない(ADR-0006決定1)
//
// 開始15分前ルールを画面が先読みしない（契約解釈ポイント(4)、reservation-frontend/adr/0001「最終
// 判定は常にAPI応答に委ねる」）。SheetDescriptionの案内文は出すが、それによって操作を無効化したり
// 一覧から除外したりはしない——キャンセル操作は常に提示し続け、可否はcancelReservationの応答で
// 決まる。
import { useState } from "react";
import { Calendar as CalendarIcon, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { cancelReservation } from "@/api/reservations";
import {
  listMyReservations,
  markMyReservationCancelled,
  type MyReservationRecord,
} from "@/api/myReservationsStore";
import type { RoomSummary } from "@/api/types";

export type MyReservationsSheetProps = {
  /** 会議室名の表示に使う(RoomSummary一覧、AvailabilityScreenが既に取得済みのものを渡す) */
  rooms: RoomSummary[];
  /**
   * このprop値が変わるたびに端末の記録を再読み込みする。予約作成(RFE-B)が成立した直後の件数反映に
   * 使う想定(呼び出し側はAvailabilityScreenのrefreshTickを渡す)。
   */
  refreshSignal: number;
  /** キャンセルが成功するたびに呼ばれる。呼び出し側は空き状況を再取得する想定(RFE-C-03の3つ目のThen) */
  onReservationCancelled: () => void;
};

export default function MyReservationsSheet({
  rooms,
  refreshSignal,
  onReservationCancelled,
}: MyReservationsSheetProps) {
  const [reservations, setReservations] = useState<MyReservationRecord[]>(() =>
    listMyReservations(),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorByReservationId, setErrorByReservationId] = useState<
    Record<string, string>
  >({});

  // 呼び出し側から再読み込みの合図(refreshSignal)が来るたびに読み直す(予約作成直後にこのSheetを
  // まだ開いていなくても件数バッジが最新化される)。「propが変わったらstateを合わせる」パターン
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // をuseEffectではなくレンダー中の調整として実装し、setStateをeffect内で同期的に呼ばない
  // （react-hooks/set-state-in-effect）。
  const [observedRefreshSignal, setObservedRefreshSignal] = useState(refreshSignal);
  if (refreshSignal !== observedRefreshSignal) {
    setObservedRefreshSignal(refreshSignal);
    setReservations(listMyReservations());
  }

  function refresh() {
    setReservations(listMyReservations());
  }

  function handleOpenChange(open: boolean) {
    // Sheetを開くたびにも読み直す(開いたまま裏で記録が変わっている場合に備える)
    if (open) refresh();
  }

  function roomName(roomId: string): string {
    return rooms.find((r) => r.roomId === roomId)?.name ?? roomId;
  }

  async function handleCancel(reservationId: string) {
    if (pendingId) return;
    setPendingId(reservationId);
    setErrorByReservationId((prev) => {
      if (!(reservationId in prev)) return prev;
      const next = { ...prev };
      delete next[reservationId];
      return next;
    });

    const result = await cancelReservation(reservationId);
    setPendingId(null);

    if (result.ok) {
      // RFE-C-03: 予約がキャンセルされたことが画面で分かる／一覧からその予約が消える
      markMyReservationCancelled(reservationId);
      refresh();
      toast.success("予約をキャンセルしました");
      onReservationCancelled();
      return;
    }

    // RFE-C-04/05: 予約は拒否され、拒否の理由が画面で分かる。一覧にその予約は残ったままである
    setErrorByReservationId((prev) => ({ ...prev, [reservationId]: result.error.message }));
    toast.error(result.error.message);
  }

  return (
    <Sheet onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          自分の予約
          {reservations.length > 0 && (
            <Badge className="ml-2 bg-blue-500">{reservations.length}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>自分の予約一覧</SheetTitle>
          <SheetDescription>キャンセルは開始15分前まで可能です</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 px-4">
          {reservations.length === 0 && (
            // RFE-C-02: この端末で予約を一度も行っていない場合、その旨が画面で分かる
            <p className="text-sm text-slate-500 text-center py-10">予約はありません</p>
          )}
          {reservations.map((reservation) => (
            <Card key={reservation.reservationId}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold">{roomName(reservation.roomId)}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500"
                    aria-label="キャンセル"
                    disabled={pendingId === reservation.reservationId}
                    onClick={() => handleCancel(reservation.reservationId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-3 w-3" /> {reservation.date}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {`${reservation.startTime} - ${reservation.endTime}`}
                  </div>
                </div>
                {errorByReservationId[reservation.reservationId] && (
                  <p role="alert" className="text-sm text-red-600 mt-2">
                    {errorByReservationId[reservation.reservationId]}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
