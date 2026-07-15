package reservation.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import reservation.adapter.persistence.ReservationSpringDataRepository;
import reservation.adapter.persistence.RoomJpaEntity;
import reservation.adapter.persistence.RoomSpringDataRepository;
import reservation.application.ReservationRepository;
import reservation.domain.Reservation;
import reservation.domain.ReservationStatus;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * L3(DB境界): このスライスの核心(RSV-K-03)。部分排他制約(WHERE cancelled_at IS NULL)により、
 * キャンセル済みの予約は占有から外れ、同じ室×時間帯に新しい予約を作成できることをPostgreSQL実機で検証する。
 * あわせて、キャンセルの永続化が楽観ロック(@Version)を介した正しいUPDATEになる(二重挿入にならない)ことも確認する。
 */
@Tag("integration")
@SpringBootTest
class CancelReservationConstraintIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);
    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private ReservationSpringDataRepository reservationSpringData;

    @Autowired
    private RoomSpringDataRepository roomSpringData;

    @BeforeEach
    void cleanAndPrepareRoom() {
        reservationSpringData.deleteAll();
        // roomsは他の統合テストクラス(同一Testcontainersコンテナを共有)が残す可能性があり、
        // name列のUNIQUE制約に触れないよう毎回全削除してから必要な行だけ作る
        roomSpringData.deleteAll();
        roomSpringData.save(new RoomJpaEntity(
                ROOM_A.id(), ROOM_A.name(),
                ROOM_A.businessHoursStart(), ROOM_A.businessHoursEnd(), ROOM_A.capacity()));
    }

    private static Reservation reservation(String reserver, String start, String end) {
        return Reservation.create(
                ROOM_A, reserver, TimeSlot.of(DATE, LocalTime.parse(start), LocalTime.parse(end)), 2);
    }

    /** DATE(予約日)とHH:mmから固定Clockを作る。 */
    private static Clock clockAt(String hhMm) {
        return Clock.fixed(
                DATE.atTime(LocalTime.parse(hhMm)).atZone(ZoneId.systemDefault()).toInstant(),
                ZoneId.systemDefault());
    }

    @Test
    void RSV_K_03_キャンセル後は同じ室x時間帯に新しい予約を作成できる_部分排他制約が占有から外す() {
        Reservation original = reservationRepository.save(reservation("佐藤", "10:00", "11:00"));

        Reservation cancelled = original.cancel("佐藤", clockAt("09:30"));
        reservationRepository.save(cancelled);

        // 事前チェック(findActiveByRoomAndDate)もDB排他制約も、キャンセル済みは占有として見ない
        Reservation newReservation = reservationRepository.save(reservation("鈴木", "10:00", "11:00"));

        assertThat(reservationSpringData.count()).isEqualTo(2);
        assertThat(reservationRepository.findActiveByRoomAndDate("room-a", DATE))
                .singleElement()
                .satisfies(active -> {
                    assertThat(active.id()).isEqualTo(newReservation.id());
                    assertThat(active.reserverId()).isEqualTo("鈴木");
                });
    }

    @Test
    void キャンセルは楽観ロックのversionを介した更新になり_同じ予約IDのまま行が1件のみ保たれる() {
        Reservation original = reservationRepository.save(reservation("佐藤", "10:00", "11:00"));

        Reservation cancelled = original.cancel("佐藤", clockAt("09:30"));
        reservationRepository.save(cancelled);

        assertThat(reservationSpringData.count()).isEqualTo(1);
        assertThat(reservationRepository.findById(original.id()))
                .hasValueSatisfying(found -> {
                    assertThat(found.id()).isEqualTo(original.id());
                    assertThat(found.status()).isEqualTo(ReservationStatus.CANCELLED);
                    assertThat(found.cancelledAt()).isEqualTo(cancelled.cancelledAt());
                });
    }

    @Test
    void findByIdはキャンセル済みの予約も返す_二重キャンセル判定に必要() {
        Reservation original = reservationRepository.save(reservation("佐藤", "10:00", "11:00"));
        reservationRepository.save(original.cancel("佐藤", clockAt("09:30")));

        assertThat(reservationRepository.findById(original.id()))
                .hasValueSatisfying(found -> assertThat(found.status()).isEqualTo(ReservationStatus.CANCELLED));
    }

    @Test
    void findByIdは存在しないIDにはOptional_emptyを返す() {
        assertThat(reservationRepository.findById(UUID.randomUUID())).isEmpty();
    }
}
