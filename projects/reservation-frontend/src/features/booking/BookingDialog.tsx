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
// 欠陥修正（人間レビュー）: クリックした空き帯の全体をそのまま予約していた（空き帯が9時間あれば
// 9時間まるごと予約されてしまう）。時間帯を「読み取り専用テキスト」から「開始/終了を選べるSelect」に
// 変更した（クリックした空き帯の範囲内・30分刻み、RSV-C-05の最小予約時間ルールに整合する既定値・
// 選択肢の絞り込みはsrc/features/booking/timeOptions.tsに分離）。骨格（会議室・日付・予約者ID・
// 参加人数・確定/キャンセルというダイアログの主要ブロック構成）は変えていない。
//
// 最終判定はAPI応答が持つ（reservation-frontend/adr/0001、契約解釈ポイント(3)）。UIでの選択肢の
// 絞り込みは体験のためのものであり、ドメインルールの再検証・先読みではない。確定の可否は常に
// createReservation の応答で決まる。
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createReservation } from "@/api/reservations";
import type { RoomSummary } from "@/api/types";
import {
  computeDefaultTimeRange,
  computeDefaultEndTime,
  generateStartTimeOptions,
  generateEndTimeOptions,
  type BookingSlot,
} from "./timeOptions";

export type { BookingSlot };

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

  // 開始/終了時刻: クリックした空き帯(slot)の範囲内で選べるようにする(欠陥修正)。
  // 既定値は空き帯の開始時刻から60分(空き帯がそれ未満なら空き帯の終了時刻まで、
  // timeOptions.computeDefaultTimeRange)。呼び出し側(AvailabilityScreen)はkey propで
  // 空き枠クリックごとにこのコンポーネントを再マウントするため、slotはこのインスタンスの
  // 生存期間中は不変であり、useStateの初期化関数でslotから導出してよい。
  const [startTime, setStartTime] = useState<string>(
    () => (slot ? computeDefaultTimeRange(slot).startTime : ""),
  );
  const [endTime, setEndTime] = useState<string>(
    () => (slot ? computeDefaultTimeRange(slot).endTime : ""),
  );

  const startOptions = useMemo(() => (slot ? generateStartTimeOptions(slot) : []), [slot]);
  const endOptions = useMemo(
    () => (slot ? generateEndTimeOptions(slot, startTime) : []),
    [slot, startTime],
  );

  function handleStartTimeChange(newStartTime: string) {
    setStartTime(newStartTime);
    // 開始時刻を変えたら、終了時刻もその開始時刻に対する既定値(60分・空き帯の終了時刻が上限)に
    // 引き直す。古い終了時刻を保ったまま開始だけ変えると、範囲外・逆転した組み合わせが残りうるため。
    if (slot) {
      setEndTime(computeDefaultEndTime(slot, newStartTime));
    }
  }

  async function handleConfirm() {
    if (!room || !slot || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    // 実APIモード（VITE_USE_REAL_RESERVATIONS_API=true、3本目の実接続）では、契約が定義しない応答・
    // fetch自体の失敗（バック未起動・接続不可）が例外として伝播する（ADR-0009 決定4）。読み取り側
    // （AvailabilityScreen）が既にそうしているのと同様、ここで受けて最小限の汎用失敗表示に落とす
    // （文言はP-05に沿って最小限に留める）。モックモードでは createReservation は例外を投げないため、
    // この経路には入らない。
    let result: Awaited<ReturnType<typeof createReservation>>;
    try {
      result = await createReservation({
        roomId: room.roomId,
        reserverId,
        date,
        startTime,
        endTime,
        attendeeCount,
      });
    } catch {
      setSubmitting(false);
      // 予約が作成されたか分からない状態なので、空き状況を再取得して実際の状態を映す
      onSettled();
      const message = "予約できませんでした。通信に失敗した可能性があります";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

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
            <Label htmlFor="startTime" className="text-right">
              開始時刻
            </Label>
            <Select value={startTime} onValueChange={handleStartTimeChange}>
              <SelectTrigger id="startTime" className="col-span-3 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {startOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4 text-sm">
            <Label htmlFor="endTime" className="text-right">
              終了時刻
            </Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger id="endTime" className="col-span-3 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {endOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
