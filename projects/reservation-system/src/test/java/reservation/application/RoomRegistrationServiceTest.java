package reservation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import reservation.domain.Room;
import reservation.domain.RoomRejectedException;
import reservation.domain.RoomRejectionReason;

/**
 * L1: 会議室登録ユースケースの単体テスト(インメモリのフェイクを使用)。
 * 契約対応: RSV-T-01(登録できる) / RSV-T-02(表示名の重複拒否)。
 * 営業時間の妥当性(RSV-T-03/04)そのものはdomainのRoomTestが担う。ここでは手順
 * (重複チェック前に営業時間検証を通すこと・保存前に拒否すること)を確認する。
 */
class RoomRegistrationServiceTest {

    private final InMemoryRoomRepository rooms = new InMemoryRoomRepository();
    private final RoomRegistrationService service = new RoomRegistrationService(rooms);

    private static RegisterRoomCommand command(String name, String start, String end, int capacity) {
        return new RegisterRoomCommand(name, LocalTime.parse(start), LocalTime.parse(end), capacity);
    }

    @Test
    void RSV_T_01_会議室を登録でき_保存される() {
        Room registered = service.register(command("会議室C", "09:00", "18:00", 8));

        assertThat(registered.name()).isEqualTo("会議室C");
        assertThat(registered.businessHoursStart()).isEqualTo(LocalTime.of(9, 0));
        assertThat(registered.businessHoursEnd()).isEqualTo(LocalTime.of(18, 0));
        assertThat(registered.capacity()).isEqualTo(8);
        assertThat(rooms.findByName("会議室C")).contains(registered);
    }

    @Test
    void RSV_T_02_既に存在する表示名は_ROOM_NAME_DUPLICATEで拒否され_保存されない() {
        rooms.add(Room.register("会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6));

        assertThatThrownBy(() -> service.register(command("会議室A", "08:00", "20:00", 10)))
                .isInstanceOfSatisfying(RoomRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RoomRejectionReason.ROOM_NAME_DUPLICATE));
        assertThat(rooms.stored()).hasSize(1);
    }

    @Test
    void 営業時間が成立しない場合は保存より前に拒否され_重複チェックすら行われない() {
        // 重複しうる名前を渡しても、営業時間の妥当性検証(I/O不要)が先に走ることを確認する
        rooms.add(Room.register("会議室D", LocalTime.of(9, 0), LocalTime.of(18, 0), 6));

        assertThatThrownBy(() -> service.register(command("会議室D", "18:00", "09:00", 6)))
                .isInstanceOfSatisfying(RoomRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RoomRejectionReason.INVALID_BUSINESS_HOURS));
        assertThat(rooms.stored()).hasSize(1);
    }

    /** RoomRepositoryポートのインメモリフェイク。 */
    private static final class InMemoryRoomRepository implements RoomRepository {

        private final Map<String, Room> store = new HashMap<>();

        void add(Room room) {
            store.put(room.id(), room);
        }

        List<Room> stored() {
            return List.copyOf(store.values());
        }

        @Override
        public Optional<Room> findById(String roomId) {
            return Optional.ofNullable(store.get(roomId));
        }

        @Override
        public List<Room> findAll() {
            return List.copyOf(store.values());
        }

        @Override
        public Optional<Room> findByName(String name) {
            return store.values().stream().filter(room -> room.name().equals(name)).findFirst();
        }

        @Override
        public Room save(Room room) {
            store.put(room.id(), room);
            return room;
        }
    }
}
