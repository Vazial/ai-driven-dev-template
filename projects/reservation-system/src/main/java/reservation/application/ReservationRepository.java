package reservation.application;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import reservation.domain.Reservation;

/** 予約の永続化ポート。実装はadapter/persistence。 */
public interface ReservationRepository {

    /**
     * 指定した部屋・日のキャンセルされていない予約を返す。
     * 時間帯は日をまたがない(TimeSlotの不変条件)ため、重なり判定はこの絞り込みで完全になる。
     */
    List<Reservation> findActiveByRoomAndDate(String roomId, LocalDate date);

    /**
     * IDで予約を1件取得する。キャンセル済みかどうかにかかわらず返す
     * (RSV-K-08の二重キャンセル判定にはキャンセル済み予約自体が必要)。
     */
    Optional<Reservation> findById(UUID id);

    /**
     * 予約を保存する(新規作成・更新のいずれも)。DB排他制約(室×時間帯の重なり禁止)が
     * 新規作成時の最終防衛であり、制約違反はTIME_SLOT_CONFLICTのReservationRejectedExceptionとして送出される。
     */
    Reservation save(Reservation reservation);
}
