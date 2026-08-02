package reservation.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reservation.domain.Room;
import reservation.domain.RoomRejectedException;
import reservation.domain.RoomRejectionReason;

/**
 * 会議室登録ユースケース(契約対応: RSV-T-01〜04)。手順: 営業時間の妥当性検証(domainのRoom.registerが
 * ルール検証、I/O不要のため先に行う) → 表示名の重複チェック(リポジトリ問い合わせが要るため後に行う。
 * CreateReservationServiceのrejectIfOverlappingと同型の配置) → 保存。
 */
@Service
public class RoomRegistrationService {

    private final RoomRepository roomRepository;

    public RoomRegistrationService(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @Transactional
    public Room register(RegisterRoomCommand command) {
        Room room = Room.register(
                command.name(), command.businessHoursStart(), command.businessHoursEnd(), command.capacity());
        rejectIfNameDuplicate(command.name());
        return roomRepository.save(room);
    }

    /** RSV-T-02: 表示名の重複拒否。 */
    private void rejectIfNameDuplicate(String name) {
        if (roomRepository.findByName(name).isPresent()) {
            throw new RoomRejectedException(RoomRejectionReason.ROOM_NAME_DUPLICATE);
        }
    }
}
