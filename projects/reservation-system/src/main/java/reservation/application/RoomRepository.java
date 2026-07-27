package reservation.application;

import java.util.List;
import java.util.Optional;
import reservation.domain.Room;

/** 会議室の取得ポート。実装はadapter/persistence。 */
public interface RoomRepository {

    Optional<Room> findById(String roomId);

    /**
     * 全会議室を取得する(契約対応: RSV-L)。並び順は未規定。呼び出し側(RoomListService)が
     * 業務ルールとして必要な並び順(name昇順)に整列する。
     */
    List<Room> findAll();
}
