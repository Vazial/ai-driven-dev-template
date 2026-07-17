package reservation.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * 会議室の予約ルール確認ユースケース(CQRSの読み側、design.md「主要な流れ(予約ルール確認)」)。
 * 手順: 部屋を取得(無ければRoomNotFoundException) → 部屋の現在の営業時間・定員と、
 * システム共通の最小予約時間(TimeSlot.minimumDurationMinutes、ドメイン1箇所の値。ADR-0006)を
 * 組み立てて返す。書き込み用のReservation集約は生成・保存しない。契約対応: RSV-R-01〜03。
 */
@Service
public class RoomRulesService {

    private final RoomRepository roomRepository;

    public RoomRulesService(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public RoomRules getRules(GetRoomRulesQuery query) {
        Room room = roomRepository.findById(query.roomId())
                .orElseThrow(() -> new RoomNotFoundException(query.roomId()));
        return new RoomRules(
                room.businessHoursStart(),
                room.businessHoursEnd(),
                room.capacity(),
                TimeSlot.minimumDurationMinutes());
    }
}
