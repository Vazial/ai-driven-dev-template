package reservation;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * 時刻はClock注入で扱う(ワークADR-0008)。
 * 通常運用は実時刻の不変Clock。受け入れテスト(プロファイルacceptance)ではPUT /test-support/clockから
 * 差し替え可能なMutableClockを使う(design.md seam仕様、RSV-K「開始15分前まで」判定の検証用)。
 * プロファイルで分岐させることで、本番構成にMutableClock(可変な時刻)が一切存在しないことを保証する。
 */
@Configuration
public class ClockConfig {

    @Bean
    @Profile("!acceptance")
    public Clock systemClock() {
        return Clock.systemDefaultZone();
    }

    @Bean
    @Profile("acceptance")
    public MutableClock acceptanceClock() {
        return new MutableClock(Clock.systemDefaultZone());
    }
}
