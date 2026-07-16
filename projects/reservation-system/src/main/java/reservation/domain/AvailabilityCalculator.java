package reservation.domain;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 空いている時間帯の計算(読み取り専用、CQRSの読み側、design.md「主要な流れ(空き枠確認)」)。
 * 営業時間から占有中の時間帯を除いた残りのうち、予約可能な最小時間(30分)以上の連続空きだけを返す
 * (RSV-A-05、ADR-0006)。Reservation集約や書き込み用リポジトリを経由しない、純粋な計算。
 */
public final class AvailabilityCalculator {

    private AvailabilityCalculator() {
    }

    /**
     * 空いている時間帯を開始時刻の昇順で返す(契約reservation-api.yamlのavailableSlots順序)。
     *
     * @param date               対象日
     * @param businessHoursStart 会議室の現在の営業時間(開始)
     * @param businessHoursEnd   会議室の現在の営業時間(終了)
     * @param occupiedSlots      その日のキャンセルされていない予約の時間帯(順不同でよい)
     */
    public static List<TimeSlot> availableSlots(
            LocalDate date,
            LocalTime businessHoursStart,
            LocalTime businessHoursEnd,
            List<TimeSlot> occupiedSlots) {
        List<TimeSlot> sortedOccupied = occupiedSlots.stream()
                .sorted(Comparator.comparing(TimeSlot::startTime))
                .toList();

        List<TimeSlot> available = new ArrayList<>();
        LocalTime cursor = businessHoursStart;
        for (TimeSlot occupied : sortedOccupied) {
            addIfBookable(available, date, cursor, occupied.startTime());
            if (occupied.endTime().isAfter(cursor)) {
                cursor = occupied.endTime();
            }
        }
        addIfBookable(available, date, cursor, businessHoursEnd);
        return available;
    }

    /** 隙間[start, end)が予約可能な空き(最小予約時間以上)なら結果に加える。負・0長の隙間は無視する。 */
    private static void addIfBookable(List<TimeSlot> available, LocalDate date, LocalTime start, LocalTime end) {
        if (TimeSlot.meetsMinimumDuration(start, end)) {
            available.add(TimeSlot.of(date, start, end));
        }
    }
}
