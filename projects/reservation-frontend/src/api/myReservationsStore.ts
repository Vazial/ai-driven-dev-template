// 「自分の予約」の端末ローカル記録（案B、reservation-frontend/adr/0006 決定2「自分の予約は端末
// ローカル（localStorage等のクライアント内ストレージ）で管理する」）。
//
// contracts/my-reservations.feature（RFE-C）解釈ポイント(1): サーバに「予約者ごとの一覧を返すAPI」は
// 無い。自分の予約の一覧は、この端末が保持している記録から組み立てる。この記録の置き場が本モジュール
// である。RFE-B（予約作成、src/features/booking/BookingDialog.tsx）は予約が成立した時点で
// recordMyReservation を呼び、この端末の記録に追加する（RFE-C-01が成立するための接続点）。
//
// 解釈ポイント(3-2)[人間裁定 2026-07-30]: キャンセルが成功した後も、端末が保持する記録そのものは
// 削除しない（論理削除。「キャンセル済み」という状態を保持したまま残す）。ただし自分の予約の一覧には
// キャンセル済みの記録を表示しない。listMyReservations() がこの可視性のフィルタリングを担い、
// 呼び出し側（画面）に「キャンセル済みを除く」判断を再実装させない。
const STORAGE_KEY = "reservation-frontend:my-reservations";

/**
 * この端末の記録の可視状態。"active" は一覧に表示される。"cancelled" は論理削除
 * (解釈ポイント(3-2))された記録で、一覧には表示しない。
 */
export type MyReservationStatus = "active" | "cancelled";

/** 端末ローカルに保持する予約1件分の記録。予約者ID等の識別情報は持たない(ADR-0006、画面に表示しない) */
export type MyReservationRecord = {
  reservationId: string;
  roomId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  status: MyReservationStatus;
};

/**
 * localStorageの読み書き。プライベートブラウジング等でlocalStorageへのアクセスが例外を投げる環境
 * でも画面自体は壊さない（記録が無いものとして扱う。P-05: 過剰なフォールバックUIは作らない）。
 */
function readAll(): MyReservationRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MyReservationRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: MyReservationRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 保存に失敗しても画面の動作は継続する(この端末に記録が残らないだけ)
  }
}

/**
 * 予約が成立した時点で、その予約をこの端末の記録に追加する(RFE-B→RFE-Cの接続点)。
 * 既定の状態は "active"(自分の予約一覧に表示される)。
 */
export function recordMyReservation(reservation: {
  reservationId: string;
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
}): void {
  const all = readAll();
  all.push({ ...reservation, status: "active" });
  writeAll(all);
}

/**
 * 自分の予約の一覧(画面表示用)。解釈ポイント(3-2)により、キャンセル済み("cancelled")の記録は
 * 含めない。
 */
export function listMyReservations(): MyReservationRecord[] {
  return readAll().filter((r) => r.status === "active");
}

/**
 * キャンセル成功後、端末側の記録を論理削除する(解釈ポイント(3-2)。物理削除しない)。
 * 対象の記録が見つからない場合は何もしない(呼び出し元は常に自分の記録から辿ったreservationIdを
 * 渡す想定のため、通常この分岐には入らない)。
 */
export function markMyReservationCancelled(reservationId: string): void {
  const all = readAll();
  const index = all.findIndex((r) => r.reservationId === reservationId);
  if (index === -1) return;
  all[index] = { ...all[index], status: "cancelled" };
  writeAll(all);
}
