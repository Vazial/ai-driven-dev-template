package reservation.domain;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;

/**
 * 予約集約。小さい集約(予約1件=1行)であり、ダブルブッキングの最終防衛はDB排他制約が担う(ワークADR-0001)。
 * 営業時間・定員は予約時点のスナップショットを保持する(ワークADR-0006)。
 * 過去の時間帯の予約は許可する(ワークADR-0004。過去枠禁止は不変条件ではない)。
 */
public class Reservation {

    private final UUID id;
    private final String roomId;
    private final String reserverId;
    private final TimeSlot timeSlot;
    private final int attendeeCount;
    private final LocalTime businessHoursStart;
    private final LocalTime businessHoursEnd;
    private final int capacitySnapshot;
    private final LocalDateTime cancelledAt;

    /** 永続化層からの再構築用。ルール検証は生成時(create)に済んでいる前提。 */
    public Reservation(
            UUID id,
            String roomId,
            String reserverId,
            TimeSlot timeSlot,
            int attendeeCount,
            LocalTime businessHoursStart,
            LocalTime businessHoursEnd,
            int capacitySnapshot,
            LocalDateTime cancelledAt) {
        this.id = Objects.requireNonNull(id, "id");
        this.roomId = Objects.requireNonNull(roomId, "roomId");
        this.reserverId = Objects.requireNonNull(reserverId, "reserverId");
        this.timeSlot = Objects.requireNonNull(timeSlot, "timeSlot");
        this.attendeeCount = attendeeCount;
        this.businessHoursStart = Objects.requireNonNull(businessHoursStart, "businessHoursStart");
        this.businessHoursEnd = Objects.requireNonNull(businessHoursEnd, "businessHoursEnd");
        this.capacitySnapshot = capacitySnapshot;
        this.cancelledAt = cancelledAt;
    }

    /**
     * 新しい予約を作る。会議室の営業時間(RSV-C-08/09)・定員(RSV-C-10)と突き合わせ、
     * 違反があれば理由コード付きで拒否する。通過した部屋設定はスナップショットとして保持する。
     */
    public static Reservation create(Room room, String reserverId, TimeSlot timeSlot, int attendeeCount) {
        if (timeSlot.startTime().isBefore(room.businessHoursStart())
                || timeSlot.endTime().isAfter(room.businessHoursEnd())) {
            throw new ReservationRejectedException(RejectionReason.OUTSIDE_BUSINESS_HOURS);
        }
        if (attendeeCount > room.capacity()) {
            throw new ReservationRejectedException(RejectionReason.EXCEEDS_CAPACITY);
        }
        return new Reservation(
                UUID.randomUUID(),
                room.id(),
                reserverId,
                timeSlot,
                attendeeCount,
                room.businessHoursStart(),
                room.businessHoursEnd(),
                room.capacity(),
                null);
    }

    /** 半開区間としての時間帯の重なり判定(RSV-C-02/03)。同じ部屋かどうかは呼び出し側が絞り込む。 */
    public boolean occupiesOverlapping(TimeSlot other) {
        return timeSlot.overlaps(other);
    }

    public UUID id() {
        return id;
    }

    public String roomId() {
        return roomId;
    }

    public String reserverId() {
        return reserverId;
    }

    public TimeSlot timeSlot() {
        return timeSlot;
    }

    public int attendeeCount() {
        return attendeeCount;
    }

    public LocalTime businessHoursStart() {
        return businessHoursStart;
    }

    public LocalTime businessHoursEnd() {
        return businessHoursEnd;
    }

    public int capacitySnapshot() {
        return capacitySnapshot;
    }

    public LocalDateTime cancelledAt() {
        return cancelledAt;
    }
}
