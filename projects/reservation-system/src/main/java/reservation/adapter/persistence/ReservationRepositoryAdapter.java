package reservation.adapter.persistence;

import java.time.LocalDate;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;
import reservation.application.ReservationRepository;
import reservation.domain.RejectionReason;
import reservation.domain.Reservation;
import reservation.domain.ReservationRejectedException;
import reservation.domain.TimeSlot;

/**
 * ReservationRepositoryポートのJPA実装。
 * DB排他制約(reservations_no_overlap)の違反を業務エラー(TIME_SLOT_CONFLICT)に翻訳する。
 */
@Repository
public class ReservationRepositoryAdapter implements ReservationRepository {

    static final String OVERLAP_CONSTRAINT = "reservations_no_overlap";

    private final ReservationSpringDataRepository springDataRepository;

    public ReservationRepositoryAdapter(ReservationSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public List<Reservation> findActiveByRoomAndDate(String roomId, LocalDate date) {
        return springDataRepository.findByRoomIdAndDateAndCancelledAtIsNull(roomId, date)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public Reservation save(Reservation reservation) {
        try {
            // 排他制約違反をこのメソッド内で捕捉するため即時flushする
            springDataRepository.saveAndFlush(toEntity(reservation));
            return reservation;
        } catch (DataIntegrityViolationException e) {
            if (isOverlapViolation(e)) {
                throw new ReservationRejectedException(RejectionReason.TIME_SLOT_CONFLICT);
            }
            throw e;
        }
    }

    private boolean isOverlapViolation(DataIntegrityViolationException e) {
        String message = e.getMostSpecificCause().getMessage();
        return message != null && message.contains(OVERLAP_CONSTRAINT);
    }

    private ReservationJpaEntity toEntity(Reservation reservation) {
        return new ReservationJpaEntity(
                reservation.id(),
                reservation.roomId(),
                reservation.reserverId(),
                reservation.timeSlot().date(),
                reservation.timeSlot().startTime(),
                reservation.timeSlot().endTime(),
                reservation.attendeeCount(),
                reservation.businessHoursStart(),
                reservation.businessHoursEnd(),
                reservation.capacitySnapshot(),
                reservation.cancelledAt());
    }

    private Reservation toDomain(ReservationJpaEntity entity) {
        return new Reservation(
                entity.getId(),
                entity.getRoomId(),
                entity.getReserverId(),
                TimeSlot.of(entity.getDate(), entity.getStartTime(), entity.getEndTime()),
                entity.getAttendeeCount(),
                entity.getBusinessHoursStart(),
                entity.getBusinessHoursEnd(),
                entity.getCapacitySnapshot(),
                entity.getCancelledAt());
    }
}
