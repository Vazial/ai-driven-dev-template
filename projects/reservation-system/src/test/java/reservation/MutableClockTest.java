package reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/**
 * L1: 受け入れテスト用seam(PUT /test-support/clock)の基盤であるMutableClockの単体テスト。
 */
class MutableClockTest {

    @Test
    void 初期値はinitialに渡したClockのinstantとzoneを返す() {
        Instant initialInstant = Instant.parse("2026-07-14T00:00:00Z");
        MutableClock clock = new MutableClock(Clock.fixed(initialInstant, ZoneOffset.UTC));

        assertThat(clock.instant()).isEqualTo(initialInstant);
        assertThat(clock.getZone()).isEqualTo(ZoneOffset.UTC);
    }

    @Test
    void setで現在時刻を差し替えられる() {
        MutableClock clock = new MutableClock(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

        LocalDateTime fixedAt = LocalDateTime.of(2026, 7, 14, 9, 45);
        clock.set(Clock.fixed(fixedAt.atZone(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC));

        assertThat(LocalDateTime.now(clock)).isEqualTo(fixedAt);
    }

    @Test
    void resetで実時刻の粒度に戻る_固定値ではなくなる() {
        MutableClock clock = new MutableClock(
                Clock.fixed(Instant.parse("2020-01-01T00:00:00Z"), ZoneOffset.UTC));

        clock.reset();

        // 実時刻は現在に近い値になる(固定された過去の時刻のままではない)
        assertThat(clock.instant()).isAfter(Instant.parse("2025-01-01T00:00:00Z"));
    }

    @Test
    void withZoneは委譲先のwithZoneの結果を返す() {
        MutableClock clock = new MutableClock(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

        Clock rezoned = clock.withZone(ZoneId.of("Asia/Tokyo"));

        assertThat(rezoned.getZone()).isEqualTo(ZoneId.of("Asia/Tokyo"));
    }
}
