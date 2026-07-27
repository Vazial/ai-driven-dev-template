package reservation.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import reservation.domain.Room;

/**
 * L1: 会議室一覧確認ユースケースの単体テスト(インメモリのフェイクを使用)。
 * 契約対応: RSV-L-01(複数の会議室をname昇順で一覧できる) / RSV-L-02(0件は空の一覧)。
 */
class RoomListServiceTest {

    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);
    private static final Room ROOM_B =
            new Room("room-b", "会議室B", LocalTime.of(8, 0), LocalTime.of(20, 0), 10);

    private final InMemoryRoomRepository rooms = new InMemoryRoomRepository();
    private final RoomListService service = new RoomListService(rooms);

    @Test
    void RSV_L_01_登録順によらずname昇順で一覧が返る() {
        // 登録順はB→Aだが、返却順はA→Bになること(name昇順)を確認する
        rooms.add(ROOM_B);
        rooms.add(ROOM_A);

        List<Room> result = service.listRooms();

        assertThat(result).containsExactly(ROOM_A, ROOM_B);
    }

    @Test
    void RSV_L_01_各要素は営業時間と定員を保持する() {
        rooms.add(ROOM_A);
        rooms.add(ROOM_B);

        List<Room> result = service.listRooms();

        assertThat(result.get(0).businessHoursStart()).isEqualTo(LocalTime.of(9, 0));
        assertThat(result.get(0).businessHoursEnd()).isEqualTo(LocalTime.of(18, 0));
        assertThat(result.get(0).capacity()).isEqualTo(6);
        assertThat(result.get(1).businessHoursStart()).isEqualTo(LocalTime.of(8, 0));
        assertThat(result.get(1).businessHoursEnd()).isEqualTo(LocalTime.of(20, 0));
        assertThat(result.get(1).capacity()).isEqualTo(10);
    }

    @Test
    void RSV_L_02_会議室が一件も無いとき空の一覧が返る() {
        List<Room> result = service.listRooms();

        assertThat(result).isEmpty();
    }

    /** RoomRepositoryポートのインメモリフェイク。 */
    private static final class InMemoryRoomRepository implements RoomRepository {

        private final List<Room> store = new ArrayList<>();

        void add(Room room) {
            store.add(room);
        }

        @Override
        public Optional<Room> findById(String roomId) {
            return store.stream().filter(room -> room.id().equals(roomId)).findFirst();
        }

        @Override
        public List<Room> findAll() {
            return List.copyOf(store);
        }
    }
}
