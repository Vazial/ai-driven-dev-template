package reservation.adapter.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalTime;

/** roomsテーブル(design.md データモデル)。 */
@Entity
@Table(name = "rooms")
public class RoomJpaEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private LocalTime businessHoursStart;

    @Column(nullable = false)
    private LocalTime businessHoursEnd;

    @Column(nullable = false)
    private int capacity;

    protected RoomJpaEntity() {
        // JPA用
    }

    public RoomJpaEntity(
            String id,
            String name,
            LocalTime businessHoursStart,
            LocalTime businessHoursEnd,
            int capacity) {
        this.id = id;
        this.name = name;
        this.businessHoursStart = businessHoursStart;
        this.businessHoursEnd = businessHoursEnd;
        this.capacity = capacity;
    }

    /** テスト用seamの「同名は上書き」用。idは変えない。 */
    public void updateSettings(LocalTime businessHoursStart, LocalTime businessHoursEnd, int capacity) {
        this.businessHoursStart = businessHoursStart;
        this.businessHoursEnd = businessHoursEnd;
        this.capacity = capacity;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public LocalTime getBusinessHoursStart() {
        return businessHoursStart;
    }

    public LocalTime getBusinessHoursEnd() {
        return businessHoursEnd;
    }

    public int getCapacity() {
        return capacity;
    }
}
