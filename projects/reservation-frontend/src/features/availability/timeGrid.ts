// タイムライン描画用の純粋関数群。時刻文字列(HH:mm)⇔分・軸上の位置(%)の変換と、
// 「空き/不可」の二値表現（reservation-frontend/adr/0006、案B）の導出を行う。
import type { AvailableTimeSlot } from "@/api/types";
import { subtractRanges } from "@/api/availabilityLogic";

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** 軸(axisStart〜axisEnd)上での区間(start〜end)の左端・幅をパーセントで返す */
export function rangeToPercent(
  start: string,
  end: string,
  axisStart: string,
  axisEnd: string,
): { left: number; width: number } {
  const axisStartMin = timeToMinutes(axisStart);
  const axisEndMin = timeToMinutes(axisEnd);
  const total = axisEndMin - axisStartMin;
  const left = ((timeToMinutes(start) - axisStartMin) / total) * 100;
  const width = ((timeToMinutes(end) - timeToMinutes(start)) / total) * 100;
  return { left, width };
}

/**
 * availableSlots（空き時間帯）から、営業時間内の「不可（予約済み等で空いていない）」区間を導出する。
 * ADR-0006（案B）: 占有情報・予約者情報は扱わず、availableSlots から「空き以外＝不可」を導出するのみ。
 * availableSlots 自身が既にreservationsの補集合であるため、同じ補集合計算をもう一度適用すれば
 * 「不可」区間（=reservationsの融合区間と同値）が得られる。
 */
export function deriveUnavailableRanges(
  businessHoursStart: string,
  businessHoursEnd: string,
  availableSlots: AvailableTimeSlot[],
): AvailableTimeSlot[] {
  return subtractRanges(businessHoursStart, businessHoursEnd, availableSlots);
}
