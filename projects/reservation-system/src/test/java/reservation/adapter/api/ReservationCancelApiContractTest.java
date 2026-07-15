package reservation.adapter.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import reservation.application.CancelReservationCommand;
import reservation.application.CancelReservationService;
import reservation.application.CreateReservationService;
import reservation.domain.RejectionReason;
import reservation.domain.Reservation;
import reservation.domain.ReservationRejectedException;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * L3: POST /reservations/{reservationId}/cancel のレスポンスが契約
 * (contracts/reservation-api.yaml RSV-K追記)と一致することの検証。DB不要(ユースケースをモック)。
 * ステータスコード(200/403/404/409/422)・レスポンス形状・理由コードを固定する。
 */
@WebMvcTest(ReservationController.class)
class ReservationCancelApiContractTest {

    private static final Room ROOM_A =
            new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);
    private static final String RESERVATION_ID = "11111111-1111-1111-1111-111111111111";

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private CreateReservationService createReservation;

    @MockitoBean
    private CancelReservationService cancelReservation;

    private ResultActions postCancel(String reserverId) throws Exception {
        return mvc.perform(post("/reservations/" + RESERVATION_ID + "/cancel")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reserverId\": \"%s\"}".formatted(reserverId)));
    }

    private static Reservation cancelledReservation() {
        Reservation reservation = Reservation.create(
                ROOM_A, "user-sato",
                TimeSlot.of(LocalDate.of(2026, 7, 14), LocalTime.of(10, 0), LocalTime.of(11, 0)),
                4);
        Clock clock = Clock.fixed(
                LocalDate.of(2026, 7, 14).atTime(9, 30).atZone(ZoneId.systemDefault()).toInstant(),
                ZoneId.systemDefault());
        return reservation.cancel("user-sato", clock);
    }

    @Test
    void RSV_K_01_キャンセル成功は200で_契約のCancelledReservationResponse形状を返す() throws Exception {
        Reservation cancelled = cancelledReservation();
        given(cancelReservation.cancel(any())).willReturn(cancelled);

        postCancel("user-sato")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reservationId").value(cancelled.id().toString()))
                .andExpect(jsonPath("$.roomId").value("room-a"))
                .andExpect(jsonPath("$.reserverId").value("user-sato"))
                .andExpect(jsonPath("$.date").value("2026-07-14"))
                .andExpect(jsonPath("$.startTime").value("10:00"))
                .andExpect(jsonPath("$.endTime").value("11:00"))
                .andExpect(jsonPath("$.attendeeCount").value(4))
                .andExpect(jsonPath("$.cancelledAt").exists());

        then(cancelReservation).should().cancel(new CancelReservationCommand(RESERVATION_ID, "user-sato"));
    }

    @Test
    void RSV_K_02_本人以外は403で_理由コードNOT_RESERVERを返す() throws Exception {
        given(cancelReservation.cancel(any()))
                .willThrow(new ReservationRejectedException(RejectionReason.NOT_RESERVER));

        postCancel("user-suzuki")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_RESERVER"))
                .andExpect(jsonPath("$.message").value("予約した本人のみキャンセルできます"));
    }

    @Test
    void RSV_K_09_予約が存在しない場合は404で_理由コードRESERVATION_NOT_FOUNDを返す() throws Exception {
        given(cancelReservation.cancel(any()))
                .willThrow(new ReservationRejectedException(RejectionReason.RESERVATION_NOT_FOUND));

        postCancel("user-sato")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESERVATION_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("予約が存在しません"));
    }

    @Test
    void RSV_K_08_既にキャンセル済みの場合は409で_理由コードALREADY_CANCELLEDを返す() throws Exception {
        given(cancelReservation.cancel(any()))
                .willThrow(new ReservationRejectedException(RejectionReason.ALREADY_CANCELLED));

        postCancel("user-sato")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_CANCELLED"))
                .andExpect(jsonPath("$.message").value("この予約は既にキャンセルされています"));
    }

    @Test
    void RSV_K_06_07_開始15分前を過ぎている場合は422で_理由コードCANCEL_DEADLINE_PASSEDを返す() throws Exception {
        given(cancelReservation.cancel(any()))
                .willThrow(new ReservationRejectedException(RejectionReason.CANCEL_DEADLINE_PASSED));

        postCancel("user-sato")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("CANCEL_DEADLINE_PASSED"))
                .andExpect(jsonPath("$.message").value("開始15分前を過ぎているためキャンセルできません"));
    }

    @Test
    void reserverId欠落は400を返す_契約のrequired違反() throws Exception {
        mvc.perform(post("/reservations/" + RESERVATION_ID + "/cancel")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
