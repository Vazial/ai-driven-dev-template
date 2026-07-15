package reservation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import reservation.domain.RejectionReason;
import reservation.domain.Reservation;
import reservation.domain.ReservationRejectedException;
import reservation.domain.ReservationStatus;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * L1: 予約キャンセルユースケースの単体テスト(インメモリのフェイクを使用)。
 * 契約対応: RSV-K-01(成功) / RSV-K-02(本人以外) / RSV-K-08(二重キャンセル) / RSV-K-09(予約が存在しない)。
 * 境界値(15分前ちょうど等)の網羅はdomain(ReservationTest)が担い、ここでは手順(取得→domain判定→保存)を確認する。
 */
class CancelReservationServiceTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);
    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);

    private final InMemoryReservationRepository reservations = new InMemoryReservationRepository();

    private static Clock clockAt(String hhMm) {
        LocalDateTime at = DATE.atTime(LocalTime.parse(hhMm));
        return Clock.fixed(at.atZone(ZoneId.systemDefault()).toInstant(), ZoneId.systemDefault());
    }

    private CancelReservationService serviceAt(String hhMm) {
        return new CancelReservationService(reservations, clockAt(hhMm));
    }

    @Test
    void RSV_K_01_本人が期限内にキャンセルすると成功し_保存される() {
        Reservation reservation = Reservation.create(ROOM_A, "佐藤", slot("10:00", "11:00"), 4);
        reservations.add(reservation);

        Reservation cancelled = serviceAt("09:44")
                .cancel(new CancelReservationCommand(reservation.id().toString(), "佐藤"));

        assertThat(cancelled.status()).isEqualTo(ReservationStatus.CANCELLED);
        assertThat(reservations.findById(reservation.id()))
                .hasValueSatisfying(saved -> assertThat(saved.status()).isEqualTo(ReservationStatus.CANCELLED));
    }

    @Test
    void RSV_K_02_本人以外はNOT_RESERVERで拒否され_保存内容は変わらない() {
        Reservation reservation = Reservation.create(ROOM_A, "佐藤", slot("10:00", "11:00"), 4);
        reservations.add(reservation);

        assertThatThrownBy(() -> serviceAt("09:00")
                .cancel(new CancelReservationCommand(reservation.id().toString(), "鈴木")))
                .isInstanceOfSatisfying(ReservationRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RejectionReason.NOT_RESERVER));
        assertThat(reservations.findById(reservation.id()))
                .hasValueSatisfying(saved -> assertThat(saved.status()).isEqualTo(ReservationStatus.CONFIRMED));
    }

    @Test
    void RSV_K_08_既にキャンセル済みの予約はALREADY_CANCELLEDで拒否される() {
        Reservation reservation = Reservation.create(ROOM_A, "佐藤", slot("10:00", "11:00"), 4);
        reservations.add(reservation);
        serviceAt("09:00").cancel(new CancelReservationCommand(reservation.id().toString(), "佐藤"));

        assertThatThrownBy(() -> serviceAt("09:10")
                .cancel(new CancelReservationCommand(reservation.id().toString(), "佐藤")))
                .isInstanceOfSatisfying(ReservationRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RejectionReason.ALREADY_CANCELLED));
    }

    @Test
    void RSV_K_09_存在しない予約はRESERVATION_NOT_FOUNDで拒否される() {
        assertThatThrownBy(() -> serviceAt("09:00")
                .cancel(new CancelReservationCommand(UUID.randomUUID().toString(), "佐藤")))
                .isInstanceOfSatisfying(ReservationRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RejectionReason.RESERVATION_NOT_FOUND));
    }

    @Test
    void 予約IDがUUID形式でない場合もRESERVATION_NOT_FOUNDで拒否される() {
        assertThatThrownBy(() -> serviceAt("09:00")
                .cancel(new CancelReservationCommand("not-a-uuid", "佐藤")))
                .isInstanceOfSatisfying(ReservationRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RejectionReason.RESERVATION_NOT_FOUND));
    }

    private static TimeSlot slot(String start, String end) {
        return TimeSlot.of(DATE, LocalTime.parse(start), LocalTime.parse(end));
    }

    /** ReservationRepositoryポートのインメモリフェイク。 */
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
