package reservation.adapter.api;

import jakarta.validation.Valid;
import java.time.format.DateTimeFormatter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reservation.application.CreateReservationCommand;
import reservation.application.CreateReservationService;
import reservation.domain.Reservation;

/** POST /reservations。契約はcontracts/reservation-api.yaml。 */
@RestController
public class ReservationController {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final CreateReservationService createReservation;

    public ReservationController(CreateReservationService createReservation) {
        this.createReservation = createReservation;
    }

    @PostMapping("/reservations")
    @ResponseStatus(HttpStatus.CREATED)
    public ReservationResponse create(@Valid @RequestBody CreateReservationRequest request) {
        Reservation reservation = createReservation.create(new CreateReservationCommand(
                request.roomId(),
                request.reserverId(),
                request.date(),
                request.startTime(),
                request.endTime(),
                request.attendeeCount()));
        return toResponse(reservation);
    }

    private ReservationResponse toResponse(Reservation reservation) {
        return new ReservationResponse(
                reservation.id().toString(),
                reservation.roomId(),
                reservation.reserverId(),
                reservation.timeSlot().date().toString(),
                HH_MM.format(reservation.timeSlot().startTime()),
                HH_MM.format(reservation.timeSlot().endTime()),
                reservation.attendeeCount());
    }
}
