// API層の型定義。
//
// これは「emerging contract」である（meta/adr/0023）: バックエンド契約
// （projects/reservation-system/contracts/reservation-api.yaml）の形状に合わせて定義しているが、
// GET /rooms（RSV-L）はまだ人間承認前のドラフト、GET /rooms/{roomId}/availability（RSV-A）は
// 承認済み。今はモック実装のみが存在し、実バックエンドとは繋がっていない。将来、実バックエンドに
// conform する際はこの型がAPI仕様への formalize の出発点になる。

/** GET /rooms のレスポンス要素（RoomSummary、reservation-api.yaml RSV-L追記・ドラフト） */
export type RoomSummary = {
  roomId: string;
  /** 会議室の表示名。予約者の氏名等の個人情報とは無関係（ADR-0006とは無関係の情報） */
  name: string;
  /** 営業時間の開始時刻（HH:mm） */
  businessHoursStart: string;
  /** 営業時間の終了時刻（HH:mm） */
  businessHoursEnd: string;
  capacity: number;
};

/** GET /rooms/{roomId}/availability の成功時に含まれる空き時間帯（AvailableTimeSlot） */
export type AvailableTimeSlot = {
  /** 開始時刻（HH:mm） */
  startTime: string;
  /** 終了時刻（HH:mm）。時間帯は半開区間で、終了時刻ちょうどは空き時間に含まない */
  endTime: string;
};

/** GET /rooms/{roomId}/availability の成功レスポンス（AvailabilityResponse） */
export type AvailabilityResponse = {
  roomId: string;
  /** YYYY-MM-DD */
  date: string;
  availableSlots: AvailableTimeSlot[];
};

/**
 * 拒否レスポンス（ProblemResponse）。
 * RFE-A（空き状況）で扱うのは ROOM_NOT_FOUND のみ。RFE-B（予約作成）ではRSV-Cの拒否理由コード
 * （TIME_SLOT_CONFLICT・TOO_SHORT・INVALID_TIME_SLOT・OUTSIDE_BUSINESS_HOURS・EXCEEDS_CAPACITY）
 * も返る（projects/reservation-system/contracts/reservation-api.yaml 参照）。
 */
export type ProblemResponse = {
  code: string;
  message: string;
};

/** 成功/拒否を型で表現する結果型。実バックエンド conform 後もこの形のまま使える想定 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProblemResponse };

/**
 * POST /reservations のリクエストボディ相当（CreateReservationRequest、
 * reservation-api.yaml。RSV-C「予約を作成できる」、承認済み）。
 */
export type CreateReservationInput = {
  roomId: string;
  /** 予約する人のID。案B（reservation-frontend/adr/0006）により自己申告・無認証 */
  reserverId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 開始時刻（HH:mm） */
  startTime: string;
  /** 終了時刻（HH:mm）。時間帯は半開区間で、終了時刻ちょうどは占有に含まない */
  endTime: string;
  attendeeCount: number;
};

/** POST /reservations の成功レスポンス相当（ReservationResponse、reservation-api.yaml） */
export type ReservationResponse = {
  reservationId: string;
  roomId: string;
  reserverId: string;
  date: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
};
