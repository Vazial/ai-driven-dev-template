// API層の型定義。
//
// 契約型（サーバとの境界にあるリクエスト/レスポンス形状）は、SSoT（バックエンドの
// projects/reservation-system/contracts/reservation-api.yaml）から `openapi-typescript` で
// 生成した src/api/schema.d.ts を単一の生成元とし、ここではそこから再エクスポートするだけに
// とどめる（ADR-0008・meta/adr/0025）。フロントは契約の2つ目の写しを持たない。生成物を更新する
// には `npm run gen:api` を実行する（生成元: `../reservation-system/contracts/reservation-api.yaml`）。
//
// 名前の差はここで吸収する: フロントの呼び出し名 `CreateReservationInput` は yaml では
// `CreateReservationRequest` という名前で定義されている。呼び出し側のコードを壊さないよう、
// このファイルでエイリアスして従来名のまま公開する。
import type { components } from "./schema.d.ts";

/** GET /rooms のレスポンス要素（RoomSummary、reservation-api.yaml RSV-L追記・承認済み） */
export type RoomSummary = components["schemas"]["RoomSummary"];

/** GET /rooms のレスポンス全体（RoomListResponse、reservation-api.yaml RSV-L追記・承認済み） */
export type RoomListResponse = components["schemas"]["RoomListResponse"];

/** GET /rooms/{roomId}/availability の成功時に含まれる空き時間帯（AvailableTimeSlot） */
export type AvailableTimeSlot = components["schemas"]["AvailableTimeSlot"];

/** GET /rooms/{roomId}/availability の成功レスポンス（AvailabilityResponse） */
export type AvailabilityResponse = components["schemas"]["AvailabilityResponse"];

/**
 * 拒否レスポンス（ProblemResponse）。
 * RFE-A（空き状況）で扱うのは ROOM_NOT_FOUND のみ。RFE-B（予約作成）ではRSV-Cの拒否理由コード
 * （TIME_SLOT_CONFLICT・TOO_SHORT・INVALID_TIME_SLOT・OUTSIDE_BUSINESS_HOURS・EXCEEDS_CAPACITY）
 * も返る（projects/reservation-system/contracts/reservation-api.yaml 参照）。
 */
export type ProblemResponse = components["schemas"]["ProblemResponse"];

/** 成功/拒否を型で表現する結果型。契約型ではなくフロント固有のエルゴノミクス型のため生成対象に含めない */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProblemResponse };

/**
 * POST /reservations のリクエストボディ相当（yamlでの名前は CreateReservationRequest、
 * reservation-api.yaml。RSV-C「予約を作成できる」、承認済み）。呼び出し側の名前を保つため
 * ここでエイリアスする。
 */
export type CreateReservationInput = components["schemas"]["CreateReservationRequest"];

/** POST /reservations の成功レスポンス相当（ReservationResponse、reservation-api.yaml） */
export type ReservationResponse = components["schemas"]["ReservationResponse"];

/**
 * POST /reservations/{reservationId}/cancel の成功レスポンス相当（CancelledReservationResponse、
 * reservation-api.yaml、RSV-K「予約をキャンセルできる」）。RFE-C（contracts/my-reservations.feature）
 * が使う。
 */
export type CancelledReservationResponse =
  components["schemas"]["CancelledReservationResponse"];

/**
 * POST /reservations/{reservationId}/cancel のリクエストボディ相当（CancelReservationRequest、
 * reservation-api.yaml、RSV-K）。実バックエンド接続（4本目のopt-in）で使う。
 */
export type CancelReservationRequest =
  components["schemas"]["CancelReservationRequest"];
