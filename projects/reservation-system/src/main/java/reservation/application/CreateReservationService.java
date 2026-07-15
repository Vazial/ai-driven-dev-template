package reservation.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reservation.domain.RejectionReason;
import reservation.domain.Reservation;
import reservation.domain.ReservationRejectedException;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * 予約作成ユースケース。手順: 部屋を取得 → スナップショット付きでReservation生成(domainがルール検証)
 * → 重なりの事前チェック(平易なエラーを返すため) → 保存(DB排他制約が最終防衛)。
 */
@Service
public class CreateReservationService {

    private final RoomRepository roomRepository;
    private final ReservationRepository reservationRepository;

    public CreateReservationService(
            RoomRepository roomRepository,
            ReservationRepository reservationRepository) {
        this.roomRepository = roomRepository;
        this.reservationRepository = reservationRepository;
    }

    @Transactional
    public Reservation create(CreateReservationCommand command) {
        Room room = roomRepository.findById(command.roomId())
                .orElseThrow(() -> new RoomNotFoundException(command.roomId()));
        TimeSlot timeSlot = TimeSlot.of(
                command.date(), command.startTime(), command.endTime());
        Reservation reservation = Reservation.create(
                room, command.reserverId(), timeSlot, command.attendeeCount());
        rejectIfOverlapping(room.id(), timeSlot);
        return reservationRepository.save(reservation);
    }

    /** 事前チェック(RSV-C-02〜04)。競合時の最終防衛はDB排他制約であり、ここは平易なエラーを返す層。 */
    private void rejectIfOverlapping(String roomId, TimeSlot timeSlot) {
        boolean overlapping = reservationRepository
                .findActiveByRoomAndDate(roomId, timeSlot.date())
                .stream()
                .anyMatch(existing -> existing.occupiesOverlapping(timeSlot));
        if (overlapping) {
            throw new ReservationRejectedException(RejectionReason.TIME_SLOT_CONFLICT);
        }
    }
}
