package reservation.application;

import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reservation.domain.RejectionReason;
import reservation.domain.Reservation;
import reservation.domain.ReservationRejectedException;

/**
 * 予約キャンセルユースケース。手順: 予約を取得(無ければRESERVATION_NOT_FOUND)
 * → domainが判定(本人確認・二重キャンセル・開始15分前の期限) → 保存。
 * 契約対応: RSV-K-01〜09。
 */
@Service
public class CancelReservationService {

    private final ReservationRepository reservationRepository;
    private final Clock clock;

    public CancelReservationService(ReservationRepository reservationRepository, Clock clock) {
        this.reservationRepository = reservationRepository;
        this.clock = clock;
    }

    @Transactional
    public Reservation cancel(CancelReservationCommand command) {
        Reservation reservation = reservationRepository.findById(parseId(command.reservationId()))
                .orElseThrow(() -> new ReservationRejectedException(RejectionReason.RESERVATION_NOT_FOUND));
        Reservation cancelled = reservation.cancel(command.requesterId(), clock);
        return reservationRepository.save(cancelled);
    }

    /** UUID形式でないIDは、予約が見つからないのと同じ扱いにする(契約の対象外領域の実装判断)。 */
    private static UUID parseId(String reservationId) {
        try {
            return UUID.fromString(reservationId);
        } catch (IllegalArgumentException e) {
            throw new ReservationRejectedException(RejectionReason.RESERVATION_NOT_FOUND);
        }
    }
}
