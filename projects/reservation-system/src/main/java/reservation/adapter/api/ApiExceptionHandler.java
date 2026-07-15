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
 * TIME_SLOT_CONFLICT → 409、それ以外の理由コード → 422。どちらもProblemResponse形状。
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ReservationRejectedException.class)
    public ResponseEntity<ProblemResponse> handleRejected(ReservationRejectedException e) {
        HttpStatus status = e.reason() == RejectionReason.TIME_SLOT_CONFLICT
                ? HttpStatus.CONFLICT
                : HttpStatus.UNPROCESSABLE_ENTITY;
        return ResponseEntity.status(status)
                .body(new ProblemResponse(e.reason().name(), e.reason().message()));
    }

    /** 契約に定義のない異常系。ProblemResponseと同形で404を返す。 */
    @ExceptionHandler(RoomNotFoundException.class)
    public ResponseEntity<ProblemResponse> handleRoomNotFound(RoomNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ProblemResponse("ROOM_NOT_FOUND", e.getMessage()));
    }
}
