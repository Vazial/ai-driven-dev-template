package reservation.domain;

/**
 * 予約が拒否される理由。コードは契約(contracts/reservation-api.yaml)の理由コードに厳密に一致させる。
 * HTTPステータスへの対応付け(TIME_SLOT_CONFLICT=409、それ以外=422)はadapter/apiの責務。
 */
public enum RejectionReason {

    /** RSV-C-02: 時間帯が既存の予約と重なっている(室×時間帯の排他的占有に違反)。 */
    TIME_SLOT_CONFLICT("時間帯が既存の予約と重なっています"),

    /** RSV-C-05: 予約が30分に満たない。 */
    TOO_SHORT("予約は30分以上でなければなりません"),

    /** RSV-C-06/07: 終了時刻が開始時刻より前、または同時刻。 */
    INVALID_TIME_SLOT("終了時刻は開始時刻より後でなければなりません"),

    /** RSV-C-08/09: 会議室の営業時間の外にはみ出している。 */
    OUTSIDE_BUSINESS_HOURS("営業時間の外です"),

    /** RSV-C-10: 人数が会議室の定員を超えている。 */
    EXCEEDS_CAPACITY("人数が定員を超えています");

    // CROSSES_DAY_BOUNDARY(日マタギ)は契約改訂で削除(ADR-0004)。
    // 日マタギはAPIスキーマ(単一date+時刻2つ)とTimeSlotの形が構造的に禁止する。

    private final String message;

    RejectionReason(String message) {
        this.message = message;
    }

    /** 人間が読める説明(契約のProblemResponse.message)。 */
    public String message() {
        return message;
    }
}
