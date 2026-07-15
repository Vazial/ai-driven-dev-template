package reservation.domain;

import java.time.LocalTime;

/**
 * 会議室。このスライスでは予約作成時の突き合わせ(営業時間・定員)に使う読み取りモデル。
 */
public record Room(
        String id,
        String name,
        LocalTime businessHoursStart,
        LocalTime businessHoursEnd,
        int capacity) {
}
