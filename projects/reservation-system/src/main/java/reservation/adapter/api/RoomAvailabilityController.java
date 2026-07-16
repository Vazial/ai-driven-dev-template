package reservation.adapter.api;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reservation.application.GetRoomAvailabilityQuery;
import reservation.application.RoomAvailabilityService;
import reservation.domain.TimeSlot;

/** GET /rooms/{roomId}/availability。契約はcontracts/reservation-api.yaml(RSV-A追記)。 */
@RestController
public class RoomAvailabilityController {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final RoomAvailabilityService roomAvailabilityService;

    public RoomAvailabilityController(RoomAvailabilityService roomAvailabilityService) {
        this.roomAvailabilityService = roomAvailabilityService;
    }

    @GetMapping("/rooms/{roomId}/availability")
    public AvailabilityResponse getAvailability(
            @PathVariable String roomId, @RequestParam LocalDate date) {
        List<TimeSlot> availableSlots =
                roomAvailabilityService.getAvailability(new GetRoomAvailabilityQuery(roomId, date));
        return new AvailabilityResponse(
                roomId,
                date.toString(),
                availableSlots.stream()
                        .map(this::toAvailableTimeSlot)
                        .toList());
    }

    private AvailableTimeSlot toAvailableTimeSlot(TimeSlot slot) {
        return new AvailableTimeSlot(HH_MM.format(slot.startTime()), HH_MM.format(slot.endTime()));
    }
}
