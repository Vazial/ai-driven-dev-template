package reservation.domain;

/**
 * 会議室の登録がドメインルールにより拒否されたことを表す。
 * 理由コード(RoomRejectionReason)を必ず伴い、adapter/apiがこれをHTTPレスポンスに翻訳する。
 */
public class RoomRejectedException extends RuntimeException {

    private final RoomRejectionReason reason;

    public RoomRejectedException(RoomRejectionReason reason) {
        super(reason.message());
        this.reason = reason;
    }

    public RoomRejectionReason reason() {
        return reason;
    }
}
