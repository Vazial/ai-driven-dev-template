package reservation.adapter.api;

import jakarta.validation.Valid;
import java.time.format.DateTimeFormatter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reservation.application.RegisterRoomCommand;
import reservation.application.RoomRegistrationService;
import reservation.domain.Room;

/** POST /rooms。契約はcontracts/reservation-api.yaml(RSV-T追記)。 */
@RestController
public class RoomRegistrationController {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final RoomRegistrationService roomRegistrationService;

    public RoomRegistrationController(RoomRegistrationService roomRegistrationService) {
        this.roomRegistrationService = roomRegistrationService;
    }

    @PostMapping("/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomSummary register(@Valid @RequestBody RoomRegistrationRequest request) {
        Room room = roomRegistrationService.register(new RegisterRoomCommand(
                request.name(), request.businessHoursStart(), request.businessHoursEnd(), request.capacity()));
        return toSummary(room);
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
