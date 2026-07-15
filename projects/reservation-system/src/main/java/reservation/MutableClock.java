package reservation;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 実行中に差し替え可能なClock。受け入れテスト用seam(PUT /test-support/clock、design.md)専用。
 * SpringプロファイルacceptanceでのみBeanとして構成される(ClockConfig参照)ため、本番構成では
 * 常に実時刻の不変Clock(Clock.systemDefaultZone())しか存在しない。
 */
public class MutableClock extends Clock {

    private final AtomicReference<Clock> delegate;

    public MutableClock(Clock initial) {
        this.delegate = new AtomicReference<>(initial);
    }

    /** 現在時刻を固定する(PUT /test-support/clock)。 */
    public void set(Clock clock) {
        delegate.set(clock);
    }

    /** 実時刻へ戻す(DELETE /test-support/reservations実行時、design.md)。 */
    public void reset() {
        delegate.set(Clock.systemDefaultZone());
    }

    @Override
    public ZoneId getZone() {
        return delegate.get().getZone();
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return delegate.get().withZone(zone);
    }

    @Override
    public Instant instant() {
        return delegate.get().instant();
    }
}
