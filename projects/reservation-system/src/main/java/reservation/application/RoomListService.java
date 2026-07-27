package reservation.application;

import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reservation.domain.Room;

/**
 * 会議室一覧確認ユースケース(CQRSの読み側、契約対応: RSV-L-01/02)。
 * 全会議室をname(表示名)昇順で返す。並び順はこのユースケースが保証する業務ルール
 * (contracts/reservation-rooms.feature Rule「表示名(name)の昇順で返す」)であり、
 * リポジトリ(adapter/persistence)には並び順を委ねない。
 * クエリ入力はパス・クエリパラメータを持たないため、GetRoomRulesQueryのような専用Queryクラスは
 * 導入しない(契約に無い入力を作らない、P-02)。
 */
@Service
public class RoomListService {

    private final RoomRepository roomRepository;

    public RoomListService(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public List<Room> listRooms() {
        return roomRepository.findAll().stream()
                .sorted(Comparator.comparing(Room::name))
                .toList();
    }
}
