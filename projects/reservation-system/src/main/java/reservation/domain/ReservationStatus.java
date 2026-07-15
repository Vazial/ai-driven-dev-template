package reservation.domain;

import java.time.LocalDateTime;

/**
 * 予約の状態。生データはcancelledAt(時間帯は含まない)であり、状態はそこから導出する
 * (ワークADR-0007: 状態は導出。規則はof()に一元化し、SSOTとして保つ)。
 * 「キャンセル済みかどうか」をこのクラス以外でcancelledAtの有無から直接判定してはならない。
 */
public enum ReservationStatus {

    /** 有効。まだキャンセルされていない。 */
    CONFIRMED,

    /** キャンセル済み。 */
    CANCELLED;

    /** cancelledAtの有無から状態を導出する唯一の場所。 */
    public static ReservationStatus of(LocalDateTime cancelledAt) {
        return cancelledAt == null ? CONFIRMED : CANCELLED;
    }
}
