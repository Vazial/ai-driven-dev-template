package reservation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reservation.domain.RejectionReason;
import reservation.domain.Reservation;
import reservation.domain.ReservationRejectedException;
import reservation.domain.Room;

/**
 * L1: 予約作成ユースケースの単体テスト(インメモリのフェイクを使用)。
 * 契約対応: RSV-C-01(作成) / RSV-C-02(重なり拒否) / RSV-C-03(隣接は可) / RSV-C-04(別の部屋は独立)。
 */
class CreateReservationServiceTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);
    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);
    private static final Room ROOM_B =
            new Room("room-b", "会議室B", LocalTime.of(9, 0), LocalTime.of(18, 0), 4);

    private final InMemoryRoomRepository rooms = new InMemoryRoomRepository();
    private final InMemoryReservationRepository reservations = new InMemoryReservationRepository();
    private final CreateReservationService service =
            new CreateReservationService(rooms, reservations);

    @BeforeEach
    void setUp() {
        rooms.add(ROOM_A);
        rooms.add(ROOM_B);
    }

    private static CreateReservationCommand command(
            String roomId, String reserver, String start, String end, int attendees) {
        return new CreateReservationCommand(
                roomId, reserver, DATE, LocalTime.parse(start), LocalTime.parse(end), attendees);
    }

    @Test
    void RSV_C_01_空いている時間帯に予約を作成でき_保存される() {
        Reservation created =
                service.create(command("room-a", "佐藤", "10:00", "11:00", 4));

        assertThat(created.roomId()).isEqualTo("room-a");
        assertThat(created.reserverId()).isEqualTo("佐藤");
        assertThat(created.timeSlot().date()).isEqualTo(DATE);
        assertThat(created.timeSlot().startTime()).isEqualTo(LocalTime.of(10, 0));
        assertThat(created.timeSlot().endTime()).isEqualTo(LocalTime.of(11, 0));
        assertThat(created.attendeeCount()).isEqualTo(4);
        assertThat(reservations.stored()).containsExactly(created);
    }

    @Test
    void RSV_C_02_重なる時間帯の予約はTIME_SLOT_CONFLICTで拒否され_保存されない() {
        service.create(command("room-a", "佐藤", "10:00", "11:00", 4));

        assertThatThrownBy(() ->
                service.create(command("room-a", "鈴木", "10:30", "11:30", 2)))
                .isInstanceOfSatisfying(ReservationRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RejectionReason.TIME_SLOT_CONFLICT));
        assertThat(reservations.stored()).hasSize(1);
    }

    @Test
    void RSV_C_03_直前の予約の終了時刻から始まる予約は作成できる() {
        service.create(command("room-a", "佐藤", "10:00", "11:00", 4));

        Reservation created =
                service.create(command("room-a", "鈴木", "11:00", "12:00", 2));

        assertThat(created.reserverId()).isEqualTo("鈴木");
        assertThat(reservations.stored()).hasSize(2);
    }

    @Test
    void RSV_C_04_別の会議室なら同じ時間帯でも予約を作成できる() {
        service.create(command("room-a", "佐藤", "10:00", "11:00", 4));

        Reservation created =
                service.create(command("room-b", "鈴木", "10:00", "11:00", 2));

        assertThat(created.roomId()).isEqualTo("room-b");
        assertThat(reservations.stored()).hasSize(2);
    }

    @Test
    void 同じ部屋でも別の日なら同じ時刻の予約を作成できる() {
        service.create(command("room-a", "佐藤", "10:00", "11:00", 4));

        Reservation created = service.create(new CreateReservationCommand(
                "room-a", "鈴木", DATE.plusDays(1),
                LocalTime.of(10, 0), LocalTime.of(11, 0), 2));

        assertThat(created.timeSlot().date()).isEqualTo(DATE.plusDays(1));
        assertThat(reservations.stored()).hasSize(2);
    }

    @Test
    void 部屋の設定に反する予約は拒否され_保存されない() {
        // ルール判定そのものはdomainのテストが担う。ここでは手順(保存前に拒否)を確認する
        assertThatThrownBy(() ->
                service.create(command("room-a", "佐藤", "10:00", "11:00", 7)))
                .isInstanceOfSatisfying(ReservationRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RejectionReason.EXCEEDS_CAPACITY));
        assertThat(reservations.stored()).isEmpty();
    }

    @Test
    void 存在しない会議室への予約はRoomNotFoundExceptionになる() {
        assertThatThrownBy(() ->
                service.create(command("no-such-room", "佐藤", "10:00", "11:00", 2)))
                .isInstanceOf(RoomNotFoundException.class)
                .hasMessageContaining("no-such-room");
        assertThat(reservations.stored()).isEmpty();
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

    /** ReservationRepositoryポートのインメモリフェイク。 */
    private static final class InMemoryReservationRepository implements ReservationRepository {

        private final List<Reservation> store = new ArrayList<>();

        @Override
        public List<Reservation> findActiveByRoomAndDate(String roomId, LocalDate date) {
            return store.stream()
                    .filter(r -> r.roomId().equals(roomId))
                    .filter(r -> r.timeSlot().date().equals(date))
                    .filter(r -> r.cancelledAt() == null)
                    .toList();
        }

        @Override
        public Optional<Reservation> findById(UUID id) {
            return store.stream().filter(r -> r.id().equals(id)).findFirst();
        }

        @Override
        public Reservation save(Reservation reservation) {
            store.removeIf(r -> r.id().equals(reservation.id()));
            store.add(reservation);
            return reservation;
        }

        List<Reservation> stored() {
            return List.copyOf(store);
        }
    }
}
