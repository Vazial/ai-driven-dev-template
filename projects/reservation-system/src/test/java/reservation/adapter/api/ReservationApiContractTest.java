package reservation.adapter.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import reservation.application.CancelReservationService;
import reservation.application.CreateReservationCommand;
import reservation.application.CreateReservationService;
import reservation.application.RoomNotFoundException;
import reservation.domain.RejectionReason;
import reservation.domain.Reservation;
import reservation.domain.ReservationRejectedException;
import reservation.domain.Room;
import reservation.domain.TimeSlot;

/**
 * L3: POST /reservations のレスポンスが契約(contracts/reservation-api.yaml)と一致することの検証。
 * DB不要(ユースケースをモック)。ステータスコード(201/409/422)・レスポンス形状・理由コードを固定する。
 */
@WebMvcTest(ReservationController.class)
class ReservationApiContractTest {

    private static final String VALID_REQUEST = """
            {
              "roomId": "room-a",
              "reserverId": "user-001",
              "date": "2026-07-14",
              "startTime": "10:00",
              "endTime": "11:00",
              "attendeeCount": 4
            }
            """;

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private CreateReservationService createReservation;

    // ReservationControllerの構築に必要(cancelエンドポイントの依存)。このクラスでは検証しない
    @MockitoBean
    private CancelReservationService cancelReservation;

    private ResultActions postReservation() throws Exception {
        return mvc.perform(post("/reservations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_REQUEST));
    }

    @Test
    void 作成成功は201で_契約のReservationResponse形状を返す() throws Exception {
        // 契約: 201 ReservationResponse(全フィールド必須、時刻はHH:mm)
        Room roomA = new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6);
        Reservation reservation = Reservation.create(
                roomA,
                "user-001",
                TimeSlot.of(
                        LocalDate.of(2026, 7, 14), LocalTime.of(10, 0), LocalTime.of(11, 0)),
                4);
        given(createReservation.create(any())).willReturn(reservation);

        postReservation()
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reservationId").value(reservation.id().toString()))
                .andExpect(jsonPath("$.roomId").value("room-a"))
                .andExpect(jsonPath("$.reserverId").value("user-001"))
                .andExpect(jsonPath("$.date").value("2026-07-14"))
                .andExpect(jsonPath("$.startTime").value("10:00"))
                .andExpect(jsonPath("$.endTime").value("11:00"))
                .andExpect(jsonPath("$.attendeeCount").value(4));

        // リクエストがそのままユースケース入力に詰め替えられること
        then(createReservation).should().create(new CreateReservationCommand(
                "room-a", "user-001", LocalDate.of(2026, 7, 14),
                LocalTime.of(10, 0), LocalTime.of(11, 0), 4));
    }

    @Test
    void RSV_C_02_時間帯の重なりは409で_理由コードTIME_SLOT_CONFLICTを返す() throws Exception {
        given(createReservation.create(any()))
                .willThrow(new ReservationRejectedException(RejectionReason.TIME_SLOT_CONFLICT));

        postReservation()
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TIME_SLOT_CONFLICT"))
                .andExpect(jsonPath("$.message").value("時間帯が既存の予約と重なっています"));
    }

    /**
     * 契約: 予約単体のルール違反は422。
     * TOO_SHORT=RSV-C-05 / INVALID_TIME_SLOT=RSV-C-06,07 / OUTSIDE_BUSINESS_HOURS=RSV-C-08,09 /
     * EXCEEDS_CAPACITY=RSV-C-10。
     * RSV-K追記のキャンセル系理由コード(NOT_RESERVER等)はこの一覧に含めない
     * (POST /reservationsからは到達しないため。cancelエンドポイントの検証はReservationCancelApiContractTest)。
     */
    @ParameterizedTest
    @EnumSource(value = RejectionReason.class,
            names = {"TOO_SHORT", "INVALID_TIME_SLOT", "OUTSIDE_BUSINESS_HOURS", "EXCEEDS_CAPACITY"})
    void 予約単体のルール違反は422で_契約のProblemResponse形状と理由コードを返す(RejectionReason reason)
            throws Exception {
        given(createReservation.create(any())).willThrow(new ReservationRejectedException(reason));

        postReservation()
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value(reason.name()))
                .andExpect(jsonPath("$.message").value(reason.message()));
    }

    @Test
    void 存在しない会議室は404を返す_契約に未定義の異常系() throws Exception {
        given(createReservation.create(any())).willThrow(new RoomNotFoundException("room-x"));

        postReservation()
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
    }

    @Test
    void 必須フィールドの欠落は400を返す_契約のrequired違反() throws Exception {
        mvc.perform(post("/reservations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\": \"room-a\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 時刻形式がHH_mmでない場合は400を返す_契約のpattern違反() throws Exception {
        mvc.perform(post("/reservations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "roomId": "room-a",
                                  "reserverId": "user-001",
                                  "date": "2026-07-14",
                                  "startTime": "9時",
                                  "endTime": "11:00",
                                  "attendeeCount": 4
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
