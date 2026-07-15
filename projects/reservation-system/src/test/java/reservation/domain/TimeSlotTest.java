package reservation.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * L1: TimeSlotの単体テスト。
 * 契約対応: RSV-C-05(30分未満) / RSV-C-06(逆転) / RSV-C-07(同一時刻)
 * および半開区間の重なり判定(RSV-C-02/03の中核ロジック)。
 * 日マタギは日付1つ+時刻2つというTimeSlotの形が構造的に禁止するため、拒否分岐は存在しない(ADR-0004)。
 */
class TimeSlotTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);

    private static TimeSlot slot(String start, String end) {
        return TimeSlot.of(DATE, LocalTime.parse(start), LocalTime.parse(end));
    }

    private static RejectionReason reasonOfCreating(LocalTime start, LocalTime end) {
        try {
            TimeSlot.of(DATE, start, end);
        } catch (ReservationRejectedException e) {
            return e.reason();
        }
        throw new AssertionError("拒否されるはずの時間帯が作成できてしまった: " + start + " - " + end);
    }

    @Nested
    class 生成時の不変条件 {

        @Test
        void RSV_C_05_30分に満たない時間帯はTOO_SHORTで拒否される() {
            assertThat(reasonOfCreating(LocalTime.of(10, 0), LocalTime.of(10, 15)))
                    .isEqualTo(RejectionReason.TOO_SHORT);
        }

        @Test
        void RSV_C_06_終了が開始より前の時間帯はINVALID_TIME_SLOTで拒否される() {
            assertThat(reasonOfCreating(LocalTime.of(11, 0), LocalTime.of(10, 0)))
                    .isEqualTo(RejectionReason.INVALID_TIME_SLOT);
        }

        @Test
        void RSV_C_07_終了と開始が同時刻の時間帯はINVALID_TIME_SLOTで拒否される() {
            assertThat(reasonOfCreating(LocalTime.of(10, 0), LocalTime.of(10, 0)))
                    .isEqualTo(RejectionReason.INVALID_TIME_SLOT);
        }

        @Test
        void ちょうど30分の時間帯は作成できる() {
            TimeSlot slot = slot("10:00", "10:30");
            assertThat(slot.startTime()).isEqualTo(LocalTime.of(10, 0));
            assertThat(slot.endTime()).isEqualTo(LocalTime.of(10, 30));
        }

        @Test
        void 拒否理由は人間が読める説明文を持つ() {
            assertThatThrownBy(() -> slot("10:00", "10:15"))
                    .isInstanceOf(ReservationRejectedException.class)
                    .hasMessage("予約は30分以上でなければなりません");
        }
    }

    @Nested
    class 半開区間の重なり判定 {

        @Test
        void RSV_C_02_一部でも重なる時間帯は重なりと判定される() {
            // 既存10:00-11:00 に対する 10:30-11:30
            assertThat(slot("10:00", "11:00").overlaps(slot("10:30", "11:30"))).isTrue();
        }

        @Test
        void RSV_C_03_直前の予約の終了時刻から始まる時間帯は重ならない() {
            // 終了時刻を含まない半開区間なので 11:00-12:00 は 10:00-11:00 と重ならない
            assertThat(slot("10:00", "11:00").overlaps(slot("11:00", "12:00"))).isFalse();
            assertThat(slot("11:00", "12:00").overlaps(slot("10:00", "11:00"))).isFalse();
        }

        @Test
        void 完全に含まれる時間帯は重なりと判定される() {
            assertThat(slot("09:00", "12:00").overlaps(slot("10:00", "10:30"))).isTrue();
        }

        @Test
        void 完全に離れた時間帯は重ならない() {
            assertThat(slot("09:00", "10:00").overlaps(slot("14:00", "15:00"))).isFalse();
        }

        @Test
        void 別の日の同じ時刻の時間帯は重ならない() {
            TimeSlot today = slot("10:00", "11:00");
            TimeSlot tomorrow = TimeSlot.of(
                    DATE.plusDays(1), LocalTime.of(10, 0), LocalTime.of(11, 0));
            assertThat(today.overlaps(tomorrow)).isFalse();
        }
    }

    @Test
    void 日付と開始終了時刻を取り出せる() {
        TimeSlot slot = slot("10:00", "11:00");
        assertThat(slot.date()).isEqualTo(DATE);
        assertThat(slot.startTime()).isEqualTo(LocalTime.of(10, 0));
        assertThat(slot.endTime()).isEqualTo(LocalTime.of(11, 0));
    }
}
