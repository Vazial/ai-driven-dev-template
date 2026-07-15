package reservation;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 時刻はClock注入で扱う(ワークADR-0008)。
 * このスライス(RSV-C)では現在時刻を使う業務ルールがない(過去の時間帯の予約は許可: ワークADR-0004)ため
 * 利用箇所はまだ無いが、注入点として先に確立しておく(キャンセルのスライスで「開始15分前まで」判定に使う)。
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
