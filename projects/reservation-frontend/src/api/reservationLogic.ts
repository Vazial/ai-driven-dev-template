// 予約作成のドメインルール判定（純粋関数）。
//
// ドメインルールの正は projects/reservation-system/contracts/reservation-create.feature（RSV-C、
// 承認済み 2026-07-13）が持つ。このスライス（RFE-B、contracts/reservation-booking.feature 解釈
// ポイント(1)）はドメインルールを再定義しない——ここでの実装は、モックAPI（src/api/reservations.ts）
// が「妥当な拒否/成功」を返すための再現であり、RSV-Cが定義する各シナリオの判定結果と一致するように
// 書いてある。本番実装がバックエンドに置き換わった際は丸ごと不要になる（availabilityLogic.tsと同じ
// 位置づけ）。
import type { CreateReservationInput, ProblemResponse, RoomSummary } from "./types";
import type { TimeRange } from "./availabilityLogic";

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** 半開区間（終了時刻ちょうどは含まない）での重なり判定。RSV-C-03と同じ意味論 */
function overlaps(a: TimeRange, b: TimeRange): boolean {
  return (
    toMinutes(a.startTime) < toMinutes(b.endTime) &&
    toMinutes(b.startTime) < toMinutes(a.endTime)
  );
}

/**
 * 予約作成の可否を判定する。拒否理由が無ければ null を返す（作成してよい）。
 *
 * 判定順序: 時間帯自体の妥当性(逆転・同一時刻) → 最小時間(30分) → 営業時間内 → 定員 → 重複。
 * RSV-Cの各シナリオはいずれも単独の違反を検証する構成のため、この順序自体はシナリオの成否には
 * 影響しない（複数のルールに同時に反する入力の優先順位は、RSV-Cが規定していない実装判断）。
 */
export function findReservationRejection(
  input: CreateReservationInput,
  room: RoomSummary,
  existingReservations: TimeRange[],
): ProblemResponse | null {
  const start = toMinutes(input.startTime);
  const end = toMinutes(input.endTime);

  // RSV-C-06/07: 終了時刻は開始時刻より後でなければならない
  if (end <= start) {
    return {
      code: "INVALID_TIME_SLOT",
      message: "終了時刻は開始時刻より後でなければなりません",
    };
  }

  // RSV-C-05: 予約は30分以上でなければならない
  if (end - start < 30) {
    return { code: "TOO_SHORT", message: "予約は30分以上でなければなりません" };
  }

  // RSV-C-08/09: 営業時間の外である
  const businessStart = toMinutes(room.businessHoursStart);
  const businessEnd = toMinutes(room.businessHoursEnd);
  if (start < businessStart || end > businessEnd) {
    return { code: "OUTSIDE_BUSINESS_HOURS", message: "営業時間の外です" };
  }

  // RSV-C-10: 人数が定員を超えている
  if (input.attendeeCount > room.capacity) {
    return { code: "EXCEEDS_CAPACITY", message: "人数が定員を超えています" };
  }

  // RSV-C-02: 時間帯が既存の予約と重なっている
  const hasConflict = existingReservations.some((existing) =>
    overlaps({ startTime: input.startTime, endTime: input.endTime }, existing),
  );
  if (hasConflict) {
    return {
      code: "TIME_SLOT_CONFLICT",
      message: "時間帯が既存の予約と重なっています",
    };
  }

  return null;
}
