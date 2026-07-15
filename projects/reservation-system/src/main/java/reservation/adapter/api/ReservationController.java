package reservation.adapter.api;

import jakarta.validation.Valid;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import reservation.application.CancelReservationCommand;
import reservation.application.CancelReservationService;
import reservation.application.CreateReservationCommand;
import reservation.application.CreateReservationService;
import reservation.domain.Reservation;

/** POST /reservations, POST /reservations/{reservationId}/cancel。契約はcontracts/reservation-api.yaml。 */
@RestController
public class ReservationController {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter ISO_OFFSET = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final CreateReservationService createReservation;
    private final CancelReservationService cancelReservation;

    public ReservationController(
            CreateReservationService createReservation, CancelReservationService cancelReservation) {
        this.createReservation = createReservation;
        this.cancelReservation = cancelReservation;
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

    @PostMapping("/reservations/{reservationId}/cancel")
    public CancelledReservationResponse cancel(
            @PathVariable String reservationId, @Valid @RequestBody CancelReservationRequest request) {
        Reservation reservation = cancelReservation.cancel(
                new CancelReservationCommand(reservationId, request.reserverId()));
        return toCancelledResponse(reservation);
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

    private CancelledReservationResponse toCancelledResponse(Reservation reservation) {
        return new CancelledReservationResponse(
                reservation.id().toString(),
                reservation.roomId(),
                reservation.reserverId(),
                reservation.timeSlot().date().toString(),
                HH_MM.format(reservation.timeSlot().startTime()),
                HH_MM.format(reservation.timeSlot().endTime()),
                reservation.attendeeCount(),
                reservation.cancelledAt().atZone(ZoneId.systemDefault()).format(ISO_OFFSET));
    }
}
