package reservation.domain;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Objects;

/**
 * 予約の時間帯。半開区間[start, end)で、終了時刻ちょうどは占有に含まない(ワークADR-0005)。
 * 「予約は同じ日の中で完結する」は、日付1つ+時刻2つというこの形自体が構造的に強制する(ADR-0004)。
 * 生成時に予約単体の不変条件を検証する: 逆転・同一時刻禁止(RSV-C-06/07) / 最小30分(RSV-C-05)。
 */
public record TimeSlot(LocalDate date, LocalTime startTime, LocalTime endTime) {

    private static final Duration MIN_DURATION = Duration.ofMinutes(30);

    public TimeSlot {
        Objects.requireNonNull(date, "date");
        Objects.requireNonNull(startTime, "startTime");
        Objects.requireNonNull(endTime, "endTime");
        if (!endTime.isAfter(startTime)) {
            throw new ReservationRejectedException(RejectionReason.INVALID_TIME_SLOT);
        }
        if (!meetsMinimumDuration(startTime, endTime)) {
            throw new ReservationRejectedException(RejectionReason.TOO_SHORT);
        }
    }

    public static TimeSlot of(LocalDate date, LocalTime startTime, LocalTime endTime) {
        return new TimeSlot(date, startTime, endTime);
    }

    /**
     * 予約可能な最小時間(30分、RSV-C-05)以上かどうかを判定する。
     * 空き枠計算(RSV-A-05)もこの判定を参照し、最小予約時間ルールをドメイン1箇所に保つ(ADR-0006)。
     * endTimeがstartTimeより前・同時刻の場合はfalseになる。
     */
    public static boolean meetsMinimumDuration(LocalTime startTime, LocalTime endTime) {
        return !endTime.isBefore(startTime) && Duration.between(startTime, endTime).compareTo(MIN_DURATION) >= 0;
    }

    /**
     * 半開区間同士の重なり判定(RSV-C-02/03)。
     * 別の日とは重ならず、前の予約の終了時刻と同時刻に始まる予約は重なりではない。
     */
    public boolean overlaps(TimeSlot other) {
        return date.equals(other.date)
                && startTime.isBefore(other.endTime)
                && other.startTime.isBefore(endTime);
    }
}
