package reservation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * L1: 予約ルール確認ユースケースの単体テスト(インメモリのフェイクを使用)。
 * 契約対応: RSV-R-01(会議室の予約ルールを確認する) / RSV-R-02(別の会議室でも最小予約時間は共通) /
 * RSV-R-03(存在しない会議室)。
 */
class RoomRulesServiceTest {

    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);
    private static final Room ROOM_B =
            new Room("room-b", "会議室B", LocalTime.of(8, 0), LocalTime.of(20, 0), 10);

    private final InMemoryRoomRepository rooms = new InMemoryRoomRepository();
    private final RoomRulesService service = new RoomRulesService(rooms);

    @BeforeEach
    void setUp() {
        rooms.add(ROOM_A);
        rooms.add(ROOM_B);
    }

    @Test
    void RSV_R_01_会議室の予約ルールとして営業時間と定員と最小予約時間が返る() {
        RoomRules rules = service.getRules(new GetRoomRulesQuery("room-a"));

        assertThat(rules.businessHoursStart()).isEqualTo(LocalTime.of(9, 0));
        assertThat(rules.businessHoursEnd()).isEqualTo(LocalTime.of(18, 0));
        assertThat(rules.capacity()).isEqualTo(6);
        assertThat(rules.minReservationDurationMinutes()).isEqualTo(30);
    }

    @Test
    void RSV_R_02_別の会議室は営業時間と定員が異なるが最小予約時間は共通の値が返る() {
        RoomRules rulesA = service.getRules(new GetRoomRulesQuery("room-a"));
        RoomRules rulesB = service.getRules(new GetRoomRulesQuery("room-b"));

        assertThat(rulesB.businessHoursStart()).isEqualTo(LocalTime.of(8, 0));
        assertThat(rulesB.businessHoursEnd()).isEqualTo(LocalTime.of(20, 0));
        assertThat(rulesB.capacity()).isEqualTo(10);
        assertThat(rulesB.minReservationDurationMinutes())
                .isEqualTo(rulesA.minReservationDurationMinutes())
                .isEqualTo(TimeSlot.minimumDurationMinutes());
    }

    @Test
    void RSV_R_03_存在しない会議室はRoomNotFoundExceptionになる() {
        assertThatThrownBy(() -> service.getRules(new GetRoomRulesQuery("no-such-room")))
                .isInstanceOf(RoomNotFoundException.class)
                .hasMessageContaining("no-such-room");
    }

    /** RoomRepositoryポートのインメモリフェイク。 */
    private static final class InMemoryRoomRepository implements RoomRepository {

        private final Map<String, Room> store = new HashMap<>();

        void add(Room room) {
            store.put(room.id(), room);
        }

        @Override
        public Optional<Room> findById(String roomId) {
            return Optional.ofNullable(store.get(roomId));
        }
    }
}
