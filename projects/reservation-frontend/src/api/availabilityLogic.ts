// 空き時間帯の計算ロジック（モックAPI内部でのみ使用する純粋関数）。
//
// 注記: 本来この計算はバックエンド（reservation-system、RSV-A/adr/0006）の責務であり、フロントは
// バックエンドが返す availableSlots をそのまま表示するだけでよい（このスライスではバックエンドの
// 計算ロジックを再検証しない。contracts/availability-view.feature 解釈ポイント(2)）。
// ここでの実装は「モックAPIが妥当なダミーデータを返すため」のものであり、本番実装がバックエンドに
// 置き換わった際は丸ごと不要になる（getRoomAvailability の内部でのみ使う）。

export type TimeRange = {
  startTime: string;
  endTime: string;
};

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * 営業時間から busyRanges（既存の占有区間）を除いた空き時間帯を返す。
 * 時間帯は半開区間（終了時刻ちょうどは含まない）として扱う。隣接する区間は融合される
 * （RSV-A-03と同じ意味論）。
 */
export function subtractRanges(
  rangeStart: string,
  rangeEnd: string,
  busyRanges: TimeRange[],
): TimeRange[] {
  const start = toMinutes(rangeStart);
  const end = toMinutes(rangeEnd);

  const busy = busyRanges
    .map((r) => ({ start: toMinutes(r.startTime), end: toMinutes(r.endTime) }))
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      last.end = Math.max(last.end, b.end);
    } else {
      merged.push({ ...b });
    }
  }

  const result: TimeRange[] = [];
  let cursor = start;
  for (const b of merged) {
    const busyStart = Math.max(b.start, start);
    const busyEnd = Math.min(b.end, end);
    if (busyStart > cursor) {
      result.push({
        startTime: toTimeString(cursor),
        endTime: toTimeString(busyStart),
      });
    }
    cursor = Math.max(cursor, busyEnd);
  }
  if (cursor < end) {
    result.push({ startTime: toTimeString(cursor), endTime: toTimeString(end) });
  }
  return result;
}
