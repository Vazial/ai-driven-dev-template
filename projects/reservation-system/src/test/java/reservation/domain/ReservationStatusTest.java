package reservation.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/**
 * L1: 状態導出の単体テスト(ワークADR-0007: 状態は生データ(cancelledAt)から導出し、
 * 規則をof()に一元化する)。
 */
class ReservationStatusTest {

    @Test
    void cancelledAtがnullならCONFIRMED() {
        assertThat(ReservationStatus.of(null)).isEqualTo(ReservationStatus.CONFIRMED);
    }

    @Test
    void cancelledAtに値があればCANCELLED() {
        assertThat(ReservationStatus.of(LocalDateTime.of(2026, 7, 14, 9, 30)))
                .isEqualTo(ReservationStatus.CANCELLED);
    }
}
