package reservation.adapter.api;

import java.time.format.DateTimeFormatter;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import reservation.application.GetRoomRulesQuery;
import reservation.application.RoomRules;
import reservation.application.RoomRulesService;

/** GET /rooms/{roomId}/rules。契約はcontracts/reservation-api.yaml(RSV-R追記)。 */
@RestController
public class RoomRulesController {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final RoomRulesService roomRulesService;

    public RoomRulesController(RoomRulesService roomRulesService) {
        this.roomRulesService = roomRulesService;
    }

    @GetMapping("/rooms/{roomId}/rules")
    public RoomRulesResponse getRules(@PathVariable String roomId) {
        RoomRules rules = roomRulesService.getRules(new GetRoomRulesQuery(roomId));
        return new RoomRulesResponse(
                roomId,
                HH_MM.format(rules.businessHoursStart()),
                HH_MM.format(rules.businessHoursEnd()),
                rules.capacity(),
                rules.minReservationDurationMinutes());
    }
}
