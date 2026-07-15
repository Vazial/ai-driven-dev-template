package reservation.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import reservation.adapter.persistence.ReservationSpringDataRepository;
import reservation.adapter.persistence.RoomJpaEntity;
import reservation.adapter.persistence.RoomSpringDataRepository;
import reservation.application.ReservationRepository;
import reservation.domain.RejectionReason;
import reservation.domain.Reservation;
import reservation.domain.ReservationRejectedException;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * L3(DB境界): ダブルブッキングの最終防衛=PostgreSQLのEXCLUDE制約の検証。
 * 事前チェック(application)を通さずポートに直接保存し、DB制約だけで拒否されることを確かめる。
 * 契約対応: RSV-C-02(重なり拒否) / RSV-C-03(隣接は可) / RSV-C-04(別の部屋は独立)。
 */
@Tag("integration")
@SpringBootTest
class DoubleBookingConstraintIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);
    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);
    private static final Room ROOM_B =
            new Room("room-b", "会議室B", LocalTime.of(9, 0), LocalTime.of(18, 0), 4);

    @Autowired
    private ReservationRepository reservationRepository;

    @Autowired
    private ReservationSpringDataRepository reservationSpringData;

    @Autowired
    private RoomSpringDataRepository roomSpringData;

    @BeforeEach
    void cleanAndPrepareRooms() {
        reservationSpringData.deleteAll();
        // roomsは他の統合テストクラス(同一Testcontainersコンテナを共有)が残す可能性があり、
        // name列のUNIQUE制約に触れないよう毎回全削除してから必要な行だけ作る
        roomSpringData.deleteAll();
        roomSpringData.save(new RoomJpaEntity(
                ROOM_A.id(), ROOM_A.name(),
                ROOM_A.businessHoursStart(), ROOM_A.businessHoursEnd(), ROOM_A.capacity()));
        roomSpringData.save(new RoomJpaEntity(
                ROOM_B.id(), ROOM_B.name(),
                ROOM_B.businessHoursStart(), ROOM_B.businessHoursEnd(), ROOM_B.capacity()));
    }

    private static Reservation reservation(Room room, String reserver, String start, String end) {
        return Reservation.create(
                room,
                reserver,
                TimeSlot.of(DATE, LocalTime.parse(start), LocalTime.parse(end)),
                2);
    }

    @Test
    void RSV_C_02_事前チェックを通さなくても重なる予約はDB排他制約が拒否しTIME_SLOT_CONFLICTに翻訳される() {
        reservationRepository.save(reservation(ROOM_A, "佐藤", "10:00", "11:00"));

        assertThatThrownBy(() ->
                reservationRepository.save(reservation(ROOM_A, "鈴木", "10:30", "11:30")))
                .isInstanceOfSatisfying(ReservationRejectedException.class, e ->
                        assertThat(e.reason()).isEqualTo(RejectionReason.TIME_SLOT_CONFLICT));
        assertThat(reservationSpringData.count()).isEqualTo(1);
    }

    @Test
    void RSV_C_03_直前の予約の終了時刻から始まる予約はDB制約でも重なりにならない() {
        reservationRepository.save(reservation(ROOM_A, "佐藤", "10:00", "11:00"));
        reservationRepository.save(reservation(ROOM_A, "鈴木", "11:00", "12:00"));

        assertThat(reservationSpringData.count()).isEqualTo(2);
    }

    @Test
    void RSV_C_04_別の会議室なら同じ時間帯でもDB制約に触れない() {
        reservationRepository.save(reservation(ROOM_A, "佐藤", "10:00", "11:00"));
        reservationRepository.save(reservation(ROOM_B, "鈴木", "10:00", "11:00"));

        assertThat(reservationSpringData.count()).isEqualTo(2);
    }

    @Test
    void 保存した予約を部屋と日付で読み戻せる() {
        Reservation saved = reservationRepository.save(reservation(ROOM_A, "佐藤", "10:00", "11:00"));

        assertThat(reservationRepository.findActiveByRoomAndDate("room-a", DATE))
                .singleElement()
                .satisfies(found -> {
                    assertThat(found.id()).isEqualTo(saved.id());
                    assertThat(found.reserverId()).isEqualTo("佐藤");
                    assertThat(found.timeSlot()).isEqualTo(saved.timeSlot());
                    assertThat(found.capacitySnapshot()).isEqualTo(6);
                });
    }
}
