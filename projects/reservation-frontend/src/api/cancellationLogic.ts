// キャンセル可否のドメインルール判定（純粋関数）。
//
// ドメインルールの正は projects/reservation-system/contracts/reservation-cancel.feature（RSV-K、
// 承認済み 2026-07-15）が持つ。このスライス（RFE-C、contracts/my-reservations.feature）が対象とする
// 拒否理由は422 CANCEL_DEADLINE_PASSEDと409 ALREADY_CANCELLEDのみである（解釈ポイント(2)(3)。
// 本人以外・存在しない予約の拒否はこの画面に到達経路が無いため対象外）。
//
// 時刻の扱い（activeContext.md・スライス指示）: 現在時刻は呼び出し元が `now: Date` として明示的に渡す。
// この関数自体はモジュール読み込み時に時刻を固定しない純粋関数であり、呼び出し元（src/api/reservations.ts
// の cancelMockReservation）が呼び出しの都度 `new Date()` を渡す。単体テストは任意の `now` を注入でき、
// E2E（Playwright page.clock）はブラウザ時計そのものを差し替えるため、この関数のインターフェースは
// どちらの経路でも時刻を制御可能にする。
import type { ProblemResponse } from "./types";

/** RSV-K「開始15分前を過ぎた予約はキャンセルできない」の閾値(分) */
const CANCEL_DEADLINE_MINUTES = 15;

export type CancellableReservation = {
  date: string;
  /** HH:mm */
  startTime: string;
  /** 既にキャンセルされている場合、キャンセル日時(truthyな値)。未キャンセルはundefined/null */
  cancelledAt?: string | null;
};

function toStartDateTime(date: string, startTime: string): Date {
  return new Date(`${date}T${startTime}:00`);
}

/**
 * キャンセルの可否を判定する。拒否理由が無ければ null を返す(キャンセルしてよい)。
 *
 * 判定順序: 二重キャンセル(解釈ポイント(5)) → 開始15分前ルール(解釈ポイント(4))。
 * RSV-K-08は「既にキャンセルされている」ことそのものが拒否理由であり、時刻に関わらず優先する。
 */
export function findCancellationRejection(
  reservation: CancellableReservation,
  now: Date,
): ProblemResponse | null {
  // RSV-K-08 / RFE-C-05: 既にキャンセルされている予約は再びキャンセルできない
  if (reservation.cancelledAt) {
    return {
      code: "ALREADY_CANCELLED",
      message: "この予約は既にキャンセルされています",
    };
  }

  // RSV-K-04〜07 / RFE-C-04: 開始15分前を過ぎた予約はキャンセルできない(15分前ちょうどは可)
  const deadline = new Date(
    toStartDateTime(reservation.date, reservation.startTime).getTime() -
      CANCEL_DEADLINE_MINUTES * 60_000,
  );
  if (now.getTime() > deadline.getTime()) {
    return {
      code: "CANCEL_DEADLINE_PASSED",
      message: "開始15分前を過ぎているためキャンセルできません",
    };
  }

  return null;
}
