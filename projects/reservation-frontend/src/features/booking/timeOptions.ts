// 予約ダイアログの時間帯(開始/終了)選択肢を計算する純粋関数群。
//
// 欠陥修正(人間レビュー): クリックした空き帯(BookingSlot)をまるごと予約するのではなく、空き帯の
// 範囲内で開始/終了時刻を利用者が選べるようにする。刻みは30分(RSV-C-05「予約は30分以上」という
// ドメインルールに整合する既定値・選択肢の絞り込みであり、最終判定は常にAPI応答が持つ
// (reservation-frontend/adr/0001、契約解釈ポイント(3))。UIでの絞り込みは体験のためのものであり、
// ドメインルールの再検証・先読みではない。
export type BookingSlot = {
  startTime: string;
  endTime: string;
};

/** 選択肢の刻み幅(分) */
export const TIME_STEP_MINUTES = 30;
/** 最小予約時間(分)。RSV-C-05のドメインルールに整合させた選択肢の絞り込みに使う */
export const MIN_DURATION_MINUTES = 30;
/** 既定の予約時間(分)。空き帯がこれ未満しか残っていない場合は空き帯の終了時刻を既定値にする */
export const DEFAULT_DURATION_MINUTES = 60;

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * 空き帯の範囲内で選べる開始時刻の一覧を、30分刻みで返す。
 * 最後の開始時刻は「空き帯の終了時刻 - 最小予約時間(30分)」までに限る
 * (それより後ろを開始にすると、空き帯内で最小予約時間すら組めなくなるため)。
 */
export function generateStartTimeOptions(slot: BookingSlot): string[] {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  const options: string[] = [];
  for (let t = start; t <= end - MIN_DURATION_MINUTES; t += TIME_STEP_MINUTES) {
    options.push(minutesToTime(t));
  }
  return options;
}

/**
 * 選んだ開始時刻から、空き帯の範囲内で選べる終了時刻の一覧を、30分刻みで返す。
 * 空き帯の終了時刻そのものは、刻みに乗らない場合でも最後の選択肢として必ず含める
 * (空き帯を最後まで使い切る終了時刻を選べなくなることを避けるため)。
 */
export function generateEndTimeOptions(slot: BookingSlot, startTime: string): string[] {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(slot.endTime);
  const options: string[] = [];
  for (let t = start + MIN_DURATION_MINUTES; t <= end; t += TIME_STEP_MINUTES) {
    options.push(minutesToTime(t));
  }
  const hasEndOfSlot = options.length > 0 && options[options.length - 1] === slot.endTime;
  if (!hasEndOfSlot && end - start >= MIN_DURATION_MINUTES) {
    options.push(slot.endTime);
  }
  return options;
}

/**
 * 開始時刻に対する既定の終了時刻を返す(既定の予約時間はDEFAULT_DURATION_MINUTES=60分。
 * 空き帯がそれ未満しか残っていなければ空き帯の終了時刻までにする)。
 */
export function computeDefaultEndTime(slot: BookingSlot, startTime: string): string {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(slot.endTime);
  const candidate = start + DEFAULT_DURATION_MINUTES;
  return minutesToTime(Math.min(candidate, end));
}

/**
 * 空き帯クリック直後の既定の時間帯を返す。
 * 開始 = 空き帯の開始時刻、終了 = 既定の予約時間(60分)または空き帯の終了時刻(短い方)。
 */
export function computeDefaultTimeRange(slot: BookingSlot): {
  startTime: string;
  endTime: string;
} {
  return {
    startTime: slot.startTime,
    endTime: computeDefaultEndTime(slot, slot.startTime),
  };
}
