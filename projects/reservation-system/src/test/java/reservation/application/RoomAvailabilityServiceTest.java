package reservation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reservation.domain.Reservation;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * L1: 空き枠確認ユースケースの単体テスト(インメモリのフェイクを使用)。
 * 契約対応: RSV-A-01(予約なし) / RSV-A-02(一部予約) / RSV-A-06(キャンセルされた予約は空き枠に戻る) /
 * RSV-A-07(存在しない会議室)。営業時間からの計算そのもの(RSV-A-03〜05)はAvailabilityCalculatorTestが担う。
 */
class RoomAvailabilityServiceTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);
    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);

    private final InMemoryRoomRepository rooms = new InMemoryRoomRepository();
    private final InMemoryReservationRepository reservations = new InMemoryReservationRepository();
    private final RoomAvailabilityService service = new RoomAvailabilityService(rooms, reservations);

    @BeforeEach
    void setUp() {
        rooms.add(ROOM_A);
    }

    private static GetRoomAvailabilityQuery query(String roomId) {
        return new GetRoomAvailabilityQuery(roomId, DATE);
    }

    private void reserve(String reserverId, String start, String end) {
        reservations.add(Reservation.create(
                ROOM_A, reserverId, TimeSlot.of(DATE, LocalTime.parse(start), LocalTime.parse(end)), 2));
    }

    @Test
    void RSV_A_01_予約のない会議室は営業時間全体が空いている() {
        List<TimeSlot> available = service.getAvailability(query("room-a"));

        assertThat(available).containsExactly(TimeSlot.of(DATE, LocalTime.of(9, 0), LocalTime.of(18, 0)));
    }

    @Test
    void RSV_A_02_予約がある時間帯は空き枠から除かれる() {
        reserve("佐藤", "10:00", "11:00");

        List<TimeSlot> available = service.getAvailability(query("room-a"));

        assertThat(available).containsExactly(
                TimeSlot.of(DATE, LocalTime.of(9, 0), LocalTime.of(10, 0)),
                TimeSlot.of(DATE, LocalTime.of(11, 0), LocalTime.of(18, 0)));
    }

    @Test
    void RSV_A_06_キャンセルされた予約の時間帯は空き枠に戻る() {
        Reservation reservation = Reservation.create(
                ROOM_A, "佐藤", TimeSlot.of(DATE, LocalTime.of(10, 0), LocalTime.of(11, 0)), 2);
        Clock clock = Clock.fixed(
                DATE.atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant(), ZoneId.systemDefault());
        reservations.add(reservation.cancel("佐藤", clock));

        List<TimeSlot> available = service.getAvailability(query("room-a"));

        assertThat(available).containsExactly(TimeSlot.of(DATE, LocalTime.of(9, 0), LocalTime.of(18, 0)));
    }

    @Test
    void RSV_A_07_存在しない会議室はRoomNotFoundExceptionになる() {
        assertThatThrownBy(() -> service.getAvailability(query("no-such-room")))
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

    /** ReservationRepositoryポートのインメモリフェイク(キャンセル済みを除外する実DBの絞り込みを再現)。 */
    private static final class InMemoryReservationRepository implements ReservationRepository {

        private final List<Reservation> store = new ArrayList<>();

        void add(Reservation reservation) {
            store.add(reservation);
        }

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
    }
}
