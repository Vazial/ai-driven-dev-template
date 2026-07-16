package reservation.application;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reservation.domain.AvailabilityCalculator;
import reservation.domain.Reservation;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * 会議室の空き枠確認ユースケース(CQRSの読み側、design.md「主要な流れ(空き枠確認)」)。
 * 手順: 部屋を取得(無ければRoomNotFoundException) → その日のキャンセルされていない予約の時間帯を取得
 * → 営業時間からそれらを除いた空き時間帯を計算する(domainのAvailabilityCalculator、ADR-0006)。
 * 書き込み用のReservation集約は生成・保存しない。契約対応: RSV-A-01〜07。
 */
@Service
public class RoomAvailabilityService {

    private final RoomRepository roomRepository;
    private final ReservationRepository reservationRepository;

    public RoomAvailabilityService(
            RoomRepository roomRepository, ReservationRepository reservationRepository) {
        this.roomRepository = roomRepository;
        this.reservationRepository = reservationRepository;
    }

    @Transactional(readOnly = true)
    public List<TimeSlot> getAvailability(GetRoomAvailabilityQuery query) {
        Room room = roomRepository.findById(query.roomId())
                .orElseThrow(() -> new RoomNotFoundException(query.roomId()));
        List<TimeSlot> occupied = reservationRepository
                .findActiveByRoomAndDate(query.roomId(), query.date())
                .stream()
                .map(Reservation::timeSlot)
                .toList();
        return AvailabilityCalculator.availableSlots(
                query.date(), room.businessHoursStart(), room.businessHoursEnd(), occupied);
    }
}
