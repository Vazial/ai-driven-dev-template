package reservation.domain;

/**
 * 会議室の登録(POST /rooms)がドメインルールにより拒否される理由。コードは契約
 * (contracts/reservation-api.yaml RSV-T追記)の理由コードに厳密に一致させる。
 * 予約(Reservation)の拒否理由(RejectionReason)とは対象(会議室自身 vs 予約1件)が異なるため、
 * 同じ列挙型を再利用せず新設した(adr/0008決定4)。
 * HTTPステータスへの対応付け(ROOM_NAME_DUPLICATE=409、それ以外=422)はadapter/apiの責務。
 */
public enum RoomRejectionReason {

    /** RSV-T-02: 同じ表示名の会議室が既に存在する(adr/0008決定3)。 */
    ROOM_NAME_DUPLICATE("同じ名前の会議室が既に存在します"),

    /** RSV-T-03/04: 営業時間の終了時刻が開始時刻より後でない(adr/0008決定4)。 */
    INVALID_BUSINESS_HOURS("営業時間の終了時刻は開始時刻より後でなければなりません");

    private final String message;

    RoomRejectionReason(String message) {
        this.message = message;
    }

    /** 人間が読める説明(契約のProblemResponse.message)。 */
    public String message() {
        return message;
    }
}
