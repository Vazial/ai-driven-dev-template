package reservation.adapter.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import reservation.application.RoomNotFoundException;
import reservation.domain.RejectionReason;
import reservation.domain.ReservationRejectedException;

/**
 * ドメインの拒否をHTTPへ翻訳する。契約(reservation-api.yaml)の対応:
 * TIME_SLOT_CONFLICT/ALREADY_CANCELLED → 409、NOT_RESERVER → 403、RESERVATION_NOT_FOUND → 404、
 * それ以外の理由コード → 422。どれもProblemResponse形状。
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ReservationRejectedException.class)
    public ResponseEntity<ProblemResponse> handleRejected(ReservationRejectedException e) {
        return ResponseEntity.status(statusFor(e.reason()))
                .body(new ProblemResponse(e.reason().name(), e.reason().message()));
    }

    private static HttpStatus statusFor(RejectionReason reason) {
        switch (reason) {
            case TIME_SLOT_CONFLICT:
            case ALREADY_CANCELLED:
                return HttpStatus.CONFLICT;
            case NOT_RESERVER:
                return HttpStatus.FORBIDDEN;
            case RESERVATION_NOT_FOUND:
                return HttpStatus.NOT_FOUND;
            default:
                return HttpStatus.UNPROCESSABLE_ENTITY;
        }
    }

    /** 契約に定義のない異常系。ProblemResponseと同形で404を返す。 */
    @ExceptionHandler(RoomNotFoundException.class)
    public ResponseEntity<ProblemResponse> handleRoomNotFound(RoomNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ProblemResponse("ROOM_NOT_FOUND", e.getMessage()));
    }
}
