package reservation.adapter.api;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reservation.adapter.persistence.ReservationSpringDataRepository;
import reservation.adapter.persistence.RoomJpaEntity;
import reservation.adapter.persistence.RoomSpringDataRepository;

/**
 * 受け入れテスト(L4)のGiven専用seam(design.md参照)。
 * Springプロファイル「acceptance」でのみ有効になり、本番構成には存在しない。
 * ここは業務APIではないため契約(reservation-api.yaml)の対象外。
 */
@RestController
@Profile("acceptance")
public class TestSupportController {

    private final RoomSpringDataRepository rooms;
    private final ReservationSpringDataRepository reservations;

    public TestSupportController(
            RoomSpringDataRepository rooms,
            ReservationSpringDataRepository reservations) {
        this.rooms = rooms;
        this.reservations = reservations;
    }

    /** 会議室の登録。同名の部屋が既にあれば設定を上書きする(idは維持)。 */
    @PostMapping("/test-support/rooms")
    @Transactional
    public ResponseEntity<RoomResponse> upsertRoom(@Valid @RequestBody RoomUpsertRequest request) {
        RoomJpaEntity room = rooms.findByName(request.name())
                .map(existing -> {
                    existing.updateSettings(
                            request.businessHoursStart(), request.businessHoursEnd(), request.capacity());
                    return existing;
                })
                .orElseGet(() -> new RoomJpaEntity(
                        UUID.randomUUID().toString(),
                        request.name(),
                        request.businessHoursStart(),
                        request.businessHoursEnd(),
                        request.capacity()));
        RoomJpaEntity saved = rooms.save(room);
        return ResponseEntity.ok(new RoomResponse(
                saved.getId(),
                saved.getName(),
                saved.getBusinessHoursStart().toString(),
                saved.getBusinessHoursEnd().toString(),
                saved.getCapacity()));
    }

    /** 全予約の削除。シナリオ間の独立性確保用。 */
    @DeleteMapping("/test-support/reservations")
    @Transactional
    public ResponseEntity<Void> deleteAllReservations() {
        reservations.deleteAll();
        return ResponseEntity.noContent().build();
    }

    public record RoomUpsertRequest(
            @NotBlank String name,
            @NotNull @JsonFormat(pattern = "HH:mm") LocalTime businessHoursStart,
            @NotNull @JsonFormat(pattern = "HH:mm") LocalTime businessHoursEnd,
            @NotNull @Min(1) Integer capacity) {
    }

    /** 部屋IDは公開API(reservation-api.yaml)の語彙に合わせてroomIdで返す(design.md seam仕様)。 */
    public record RoomResponse(
            String roomId,
            String name,
            String businessHoursStart,
            String businessHoursEnd,
            int capacity) {
    }
}
