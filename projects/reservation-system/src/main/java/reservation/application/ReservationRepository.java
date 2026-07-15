package reservation.application;

import java.time.LocalDate;
import java.util.List;
import reservation.domain.Reservation;

/** 予約の永続化ポート。実装はadapter/persistence。 */
public interface ReservationRepository {

    /**
     * 指定した部屋・日のキャンセルされていない予約を返す。
     * 時間帯は日をまたがない(TimeSlotの不変条件)ため、重なり判定はこの絞り込みで完全になる。
     */
    List<Reservation> findActiveByRoomAndDate(String roomId, LocalDate date);

    /**
     * 予約を保存する。DB排他制約(室×時間帯の重なり禁止)が最終防衛であり、
     * 制約違反はTIME_SLOT_CONFLICTのReservationRejectedExceptionとして送出される。
     */
    Reservation save(Reservation reservation);
}
