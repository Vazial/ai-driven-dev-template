package reservation.application;

import java.util.Optional;
import reservation.domain.Room;

/** 会議室の取得ポート。実装はadapter/persistence。 */
public interface RoomRepository {

    Optional<Room> findById(String roomId);
}
