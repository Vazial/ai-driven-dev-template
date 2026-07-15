package reservation.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/**
 * L1: Reservation集約の単体テスト。
 * 契約対応: RSV-C-01(作成) / RSV-C-08/09(営業時間外) / RSV-C-10(定員超過)。
 * 営業時間・定員は部屋のスナップショットとの突き合わせ(ワークADR-0006)。
 */
class ReservationTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);
    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);

    private static TimeSlot slot(String start, String end) {
        return TimeSlot.of(DATE, LocalTime.parse(start), LocalTime.parse(end));
    }

    private static RejectionReason reasonOfCreating(Room room, TimeSlot slot, int attendeeCount) {
        try {
            Reservation.create(room, "user-001", slot, attendeeCount);
        } catch (ReservationRejectedException e) {
            return e.reason();
        }
        throw new AssertionError("拒否されるはずの予約が作成できてしまった");
    }

    @Test
    void RSV_C_01_営業時間内かつ定員以内の予約は作成でき_部屋設定のスナップショットを持つ() {
        Reservation reservation =
                Reservation.create(ROOM_A, "佐藤", slot("10:00", "11:00"), 4);

        assertThat(reservation.id()).isNotNull();
        assertThat(reservation.roomId()).isEqualTo("room-a");
        assertThat(reservation.reserverId()).isEqualTo("佐藤");
        assertThat(reservation.timeSlot()).isEqualTo(slot("10:00", "11:00"));
        assertThat(reservation.attendeeCount()).isEqualTo(4);
        // 予約時点の営業時間・定員のスナップショット(ワークADR-0006)
        assertThat(reservation.businessHoursStart()).isEqualTo(LocalTime.of(9, 0));
        assertThat(reservation.businessHoursEnd()).isEqualTo(LocalTime.of(18, 0));
        assertThat(reservation.capacitySnapshot()).isEqualTo(6);
        // このスライスではキャンセルは常に無い
        assertThat(reservation.cancelledAt()).isNull();
    }

    @Test
    void RSV_C_08_営業時間より前に始まる予約はOUTSIDE_BUSINESS_HOURSで拒否される() {
        assertThat(reasonOfCreating(ROOM_A, slot("08:00", "09:30"), 2))
                .isEqualTo(RejectionReason.OUTSIDE_BUSINESS_HOURS);
    }

    @Test
    void RSV_C_09_営業時間を超えて終わる予約はOUTSIDE_BUSINESS_HOURSで拒否される() {
        assertThat(reasonOfCreating(ROOM_A, slot("17:30", "18:30"), 2))
                .isEqualTo(RejectionReason.OUTSIDE_BUSINESS_HOURS);
    }

    @Test
    void RSV_C_10_定員を超える人数の予約はEXCEEDS_CAPACITYで拒否される() {
        assertThat(reasonOfCreating(ROOM_A, slot("10:00", "11:00"), 7))
                .isEqualTo(RejectionReason.EXCEEDS_CAPACITY);
    }

    @Test
    void 営業時間ちょうどの予約は作成できる() {
        Reservation reservation =
                Reservation.create(ROOM_A, "佐藤", slot("09:00", "18:00"), 2);
        assertThat(reservation.timeSlot().startTime()).isEqualTo(LocalTime.of(9, 0));
        assertThat(reservation.timeSlot().endTime()).isEqualTo(LocalTime.of(18, 0));
    }

    @Test
    void 定員ちょうどの人数の予約は作成できる() {
        Reservation reservation =
                Reservation.create(ROOM_A, "佐藤", slot("10:00", "11:00"), 6);
        assertThat(reservation.attendeeCount()).isEqualTo(6);
    }

    @Test
    void 予約ごとに異なるIDが割り当てられる() {
        Reservation first = Reservation.create(ROOM_A, "佐藤", slot("10:00", "11:00"), 4);
        Reservation second = Reservation.create(ROOM_A, "鈴木", slot("11:00", "12:00"), 2);
        assertThat(first.id()).isNotEqualTo(second.id());
    }

    @Test
    void 時間帯の重なり判定はTimeSlotの半開区間の規則に従う() {
        Reservation reservation = Reservation.create(ROOM_A, "佐藤", slot("10:00", "11:00"), 4);
        assertThat(reservation.occupiesOverlapping(slot("10:30", "11:30"))).isTrue();
        assertThat(reservation.occupiesOverlapping(slot("11:00", "12:00"))).isFalse();
    }

    @Test
    void 永続化層からの再構築では全フィールドが保たれる() {
        // 再構築コンストラクタ(persistence用)。cancelledAtは次スライスで値を持つが、保持自体は今も保証する
        java.time.LocalDateTime cancelledAt = DATE.atTime(9, 30);
        java.util.UUID id = java.util.UUID.randomUUID();
        Reservation restored = new Reservation(
                id, "room-a", "佐藤", slot("10:00", "11:00"), 4,
                LocalTime.of(9, 0), LocalTime.of(18, 0), 6, cancelledAt);
        assertThat(restored.id()).isEqualTo(id);
        assertThat(restored.cancelledAt()).isEqualTo(cancelledAt);
    }
}
