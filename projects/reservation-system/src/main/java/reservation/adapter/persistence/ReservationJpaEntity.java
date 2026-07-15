package reservation.adapter.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * reservationsテーブル(design.md データモデル)。予約1件=1行。
 * 排他制約(room_id×時間範囲、WHERE cancelled_at IS NULL)はFlywayマイグレーションが定義する。
 */
@Entity
@Table(name = "reservations")
public class ReservationJpaEntity {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String roomId;

    @Column(nullable = false)
    private String reserverId;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    @Column(nullable = false)
    private int attendeeCount;

    @Column(nullable = false)
    private LocalTime businessHoursStart;

    @Column(nullable = false)
    private LocalTime businessHoursEnd;

    @Column(nullable = false)
    private int capacitySnapshot;

    @Column
    private LocalDateTime cancelledAt;

    @Version
    private long version;

    protected ReservationJpaEntity() {
        // JPA用
    }

    public ReservationJpaEntity(
            UUID id,
            String roomId,
            String reserverId,
            LocalDate date,
            LocalTime startTime,
            LocalTime endTime,
            int attendeeCount,
            LocalTime businessHoursStart,
            LocalTime businessHoursEnd,
            int capacitySnapshot,
            LocalDateTime cancelledAt) {
        this.id = id;
        this.roomId = roomId;
        this.reserverId = reserverId;
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.attendeeCount = attendeeCount;
        this.businessHoursStart = businessHoursStart;
        this.businessHoursEnd = businessHoursEnd;
        this.capacitySnapshot = capacitySnapshot;
        this.cancelledAt = cancelledAt;
    }

    public UUID getId() {
        return id;
    }

    public String getRoomId() {
        return roomId;
    }

    public String getReserverId() {
        return reserverId;
    }

    public LocalDate getDate() {
        return date;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public int getAttendeeCount() {
        return attendeeCount;
    }

    public LocalTime getBusinessHoursStart() {
        return businessHoursStart;
    }

    public LocalTime getBusinessHoursEnd() {
        return businessHoursEnd;
    }

    public int getCapacitySnapshot() {
        return capacitySnapshot;
    }

    public LocalDateTime getCancelledAt() {
        return cancelledAt;
    }
}
