package reservation.domain;

import java.time.LocalTime;
import java.util.UUID;

/**
 * 会議室。予約作成時の突き合わせ(営業時間・定員)に使う読み取りモデルであり、
 * 会議室自身の登録(register、契約対応: RSV-T)も担う。
 */
public record Room(
        String id,
        String name,
        LocalTime businessHoursStart,
        LocalTime businessHoursEnd,
        int capacity) {

    /**
     * 新しい会議室を登録する(契約対応: RSV-T-01)。IDはサーバ採番(adr/0008決定1)。
     * 営業時間の妥当性(終了時刻は開始時刻より後、RSV-T-03/04)を検証する。表示名の重複チェック
     * (ROOM_NAME_DUPLICATE、RSV-T-02)はリポジトリ問い合わせが要るため、この生成後に
     * 呼び出し側(RoomRegistrationService)が行う(CreateReservationServiceの
     * rejectIfOverlappingと同型の配置)。
     */
    public static Room register(
            String name, LocalTime businessHoursStart, LocalTime businessHoursEnd, int capacity) {
        if (!businessHoursEnd.isAfter(businessHoursStart)) {
            throw new RoomRejectedException(RoomRejectionReason.INVALID_BUSINESS_HOURS);
        }
        return new Room(UUID.randomUUID().toString(), name, businessHoursStart, businessHoursEnd, capacity);
    }
}
