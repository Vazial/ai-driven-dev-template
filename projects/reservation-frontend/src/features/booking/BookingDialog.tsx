// RFE-B「空いている時間帯を予約できる」の予約ダイアログ。
//
// contracts/reservation-booking.feature（RFE-B-01/02/03）を満たす対象。BookingDesign.tsx
// （src/design-preview/、承認済みモック）の予約ダイアログ骨格（会議室・時間帯の表示、参加人数入力、
// キャンセル/確定ボタンを持つDialog）を保つ（meta/adr/0021、骨格の作り替えをしない）。
//
// 適用した設計調整（reservation-frontend/adr/0006「案B」、design/reconciliation/
// booking-design-reconciliation.md 9節）:
//   - 表示名フィールドは出さない。予約者ID(reserverId)を自己申告で入力する（項目5・15/16の帰結）
//   - 予約後の時間調整に関する案内文は出さない（PATCH /reservations/{id}は当面不採用、項目22）
//
// 最終判定はAPI応答が持つ（reservation-frontend/adr/0001、契約解釈ポイント(3)）。このダイアログは
// ドメインルールを自前で再検証・先読みしない。確定の可否は常に createReservation の応答で決まる。
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { createReservation } from "@/api/reservations";
import type { RoomSummary } from "@/api/types";

export type BookingSlot = {
  startTime: string;
  endTime: string;
};

export type BookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: RoomSummary | null;
  /** YYYY-MM-DD */
  date: string;
  slot: BookingSlot | null;
  /**
   * 予約確定の試行が完了するたびに呼ばれる(成功・拒否のいずれでも)。
   * 呼び出し側は空き状況を再取得し、画面をサーバの実際の状態と同期させる想定
   * （RFE-B-02のタイムライン反映、RFE-B-03の「予約済み(不可)のまま」の反映の双方に対応する）。
   */
  onSettled: () => void;
};

// 注記: このコンポーネントはフォーム状態(reserverId・attendeeCount等)を内部stateで持つ。新しい
// 空き枠が選択されるたびにフォームをリセットしたい場合、呼び出し側は変化する値をkey propに渡して
// 強制的に再マウントすること（React推奨のstateリセット手法。エフェクトでのリセットは行わない）。

export default function BookingDialog({
  open,
  onOpenChange,
  room,
  date,
  slot,
  onSettled,
}: BookingDialogProps) {
  const [reserverId, setReserverId] = useState("");
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    if (!room || !slot || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    const result = await createReservation({
      roomId: room.roomId,
      reserverId,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      attendeeCount,
    });

    setSubmitting(false);
    // 成功・拒否のいずれでも空き状況を再取得し、画面をサーバの実際の状態と同期する
    onSettled();

    if (result.ok) {
      // RFE-B-02: 予約が完了したことが画面で分かる
      toast.success("予約が完了しました");
      onOpenChange(false);
      return;
    }

    // RFE-B-03: 予約は拒否され、拒否の理由が画面で分かる
    setErrorMessage(result.error.message);
    toast.error(result.error.message);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>会議室の予約</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4 text-sm">
            <Label className="text-right">会議室</Label>
            <div className="col-span-3 font-semibold">{room?.name}</div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4 text-sm">
            <Label className="text-right">日付</Label>
            <div className="col-span-3">{date}</div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4 text-sm">
            <Label className="text-right">時間帯</Label>
            <Badge variant="outline" className="w-fit col-span-3 text-base">
              {slot ? `${slot.startTime}〜${slot.endTime}` : ""}
            </Badge>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reserverId" className="text-right">
              予約者ID
            </Label>
            <Input
              id="reserverId"
              value={reserverId}
              onChange={(e) => setReserverId(e.target.value)}
              className="col-span-3"
              placeholder="例: sato"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="attendees" className="text-right">
              参加人数
            </Label>
            <Input
              id="attendees"
              type="number"
              min={1}
              value={attendeeCount}
              onChange={(e) => setAttendeeCount(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
          {errorMessage && (
            // RFE-B-03: 拒否の理由が画面で分かる
            <p role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            予約を確定する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
