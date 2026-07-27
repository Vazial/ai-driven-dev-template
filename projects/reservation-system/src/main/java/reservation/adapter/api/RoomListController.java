package reservation.adapter.api;

import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import reservation.application.RoomListService;
import reservation.domain.Room;

/** GET /rooms。契約はcontracts/reservation-api.yaml(RSV-L追記)。 */
@RestController
public class RoomListController {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final RoomListService roomListService;

    public RoomListController(RoomListService roomListService) {
        this.roomListService = roomListService;
    }

    @GetMapping("/rooms")
    public RoomListResponse listRooms() {
        List<RoomSummary> rooms = roomListService.listRooms().stream()
                .map(this::toSummary)
                .toList();
        return new RoomListResponse(rooms);
    }

    private RoomSummary toSummary(Room room) {
        return new RoomSummary(
                room.id(),
                room.name(),
                HH_MM.format(room.businessHoursStart()),
                HH_MM.format(room.businessHoursEnd()),
                room.capacity());
    }
}
