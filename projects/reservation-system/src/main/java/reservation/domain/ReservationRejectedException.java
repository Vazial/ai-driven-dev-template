package reservation.domain;

/**
 * 予約の作成がドメインルールにより拒否されたことを表す。
 * 理由コード(RejectionReason)を必ず伴い、adapter/apiがこれをHTTPレスポンスに翻訳する。
 */
public class ReservationRejectedException extends RuntimeException {

    private final RejectionReason reason;

    public ReservationRejectedException(RejectionReason reason) {
        super(reason.message());
        this.reason = reason;
    }

    public RejectionReason reason() {
        return reason;
    }
}
