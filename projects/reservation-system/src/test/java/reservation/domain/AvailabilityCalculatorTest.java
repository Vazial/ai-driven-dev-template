package reservation.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * L1: 空き枠計算(AvailabilityCalculator)の単体テスト。
 * 契約対応: RSV-A-01(予約なし) / RSV-A-02(一部予約) / RSV-A-03(隣接予約) / RSV-A-04(全埋まり) /
 * RSV-A-05(最小予約時間未満の隙間を除外、ADR-0006)。RSV-A-06(キャンセル)・RSV-A-07(部屋なし)は
 * この計算自体には現れない(それぞれ呼び出し側の絞り込み・RoomAvailabilityServiceの責務)ため、
 * それらの契約対応はRoomAvailabilityServiceTestで検証する。
 */
class AvailabilityCalculatorTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);
    private static final LocalTime BUSINESS_START = LocalTime.of(9, 0);
    private static final LocalTime BUSINESS_END = LocalTime.of(18, 0);

    private static TimeSlot slot(String start, String end) {
        return TimeSlot.of(DATE, LocalTime.parse(start), LocalTime.parse(end));
    }

    private static List<TimeSlot> available(TimeSlot... occupied) {
        return AvailabilityCalculator.availableSlots(DATE, BUSINESS_START, BUSINESS_END, List.of(occupied));
    }

    @Test
    void RSV_A_01_予約が一つもない会議室は営業時間の全体が空いている() {
        assertThat(available()).containsExactly(slot("09:00", "18:00"));
    }

    @Test
    void RSV_A_02_一部の時間帯に予約がある会議室は予約以外の時間帯が空いている() {
        assertThat(available(slot("10:00", "11:00")))
                .containsExactly(slot("09:00", "10:00"), slot("11:00", "18:00"));
    }

    @Test
    void RSV_A_03_隙間なく隣り合う予約の間に空き枠は生まれない() {
        assertThat(available(slot("10:00", "11:00"), slot("11:00", "12:00")))
                .containsExactly(slot("09:00", "10:00"), slot("12:00", "18:00"));
    }

    @Test
    void RSV_A_04_営業時間の全てに予約がある会議室は空き枠が一つもない() {
        assertThat(available(slot("09:00", "18:00"))).isEmpty();
    }

    @Test
    void RSV_A_05_最小予約時間に満たない隙間は空き枠に現れない() {
        assertThat(available(slot("10:00", "11:00"), slot("11:15", "12:00")))
                .containsExactly(slot("09:00", "10:00"), slot("12:00", "18:00"));
    }

    @Test
    void ちょうど30分の隙間は空き枠として現れる() {
        assertThat(available(slot("10:00", "10:30"), slot("11:00", "12:00")))
                .containsExactly(slot("09:00", "10:00"), slot("10:30", "11:00"), slot("12:00", "18:00"));
    }

    @Test
    void 予約が開始時刻の順で渡されなくても正しく計算される() {
        assertThat(available(slot("11:00", "12:00"), slot("09:30", "10:00")))
                .containsExactly(slot("09:00", "09:30"), slot("10:00", "11:00"), slot("12:00", "18:00"));
    }

    @Test
    void 複数の予約が全て隙間なく営業時間を埋める場合は空き枠が一つもない() {
        assertThat(available(slot("09:00", "12:00"), slot("12:00", "15:00"), slot("15:00", "18:00")))
                .isEmpty();
    }
}
