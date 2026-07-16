package reservation.adapter.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import reservation.application.GetRoomAvailabilityQuery;
import reservation.application.RoomAvailabilityService;
import reservation.application.RoomNotFoundException;
import reservation.domain.TimeSlot;

/**
 * L3: GET /rooms/{roomId}/availability のレスポンスが契約(contracts/reservation-api.yaml RSV-A追記)と
 * 一致することの検証。DB不要(ユースケースをモック)。ステータスコード(200/404)・レスポンス形状を固定する。
 */
@WebMvcTest(RoomAvailabilityController.class)
class RoomAvailabilityApiContractTest {

    private static final LocalDate DATE = LocalDate.of(2026, 7, 14);

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private RoomAvailabilityService roomAvailabilityService;

    @Test
    void RSV_A_02_空き枠取得成功は200で_契約のAvailabilityResponse形状を返す() throws Exception {
        given(roomAvailabilityService.getAvailability(new GetRoomAvailabilityQuery("room-a", DATE)))
                .willReturn(List.of(
                        TimeSlot.of(DATE, LocalTime.of(9, 0), LocalTime.of(10, 0)),
                        TimeSlot.of(DATE, LocalTime.of(11, 0), LocalTime.of(18, 0))));

        mvc.perform(get("/rooms/room-a/availability").param("date", "2026-07-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("room-a"))
                .andExpect(jsonPath("$.date").value("2026-07-14"))
                .andExpect(jsonPath("$.availableSlots[0].startTime").value("09:00"))
                .andExpect(jsonPath("$.availableSlots[0].endTime").value("10:00"))
                .andExpect(jsonPath("$.availableSlots[1].startTime").value("11:00"))
                .andExpect(jsonPath("$.availableSlots[1].endTime").value("18:00"));

        then(roomAvailabilityService).should()
                .getAvailability(new GetRoomAvailabilityQuery("room-a", DATE));
    }

    @Test
    void RSV_A_04_空き枠が一つもない場合は200で_空配列を返す() throws Exception {
        given(roomAvailabilityService.getAvailability(any())).willReturn(List.of());

        mvc.perform(get("/rooms/room-a/availability").param("date", "2026-07-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availableSlots").isArray())
                .andExpect(jsonPath("$.availableSlots").isEmpty());
    }

    @Test
    void RSV_A_07_存在しない会議室は404で_理由コードROOM_NOT_FOUNDを返す() throws Exception {
        given(roomAvailabilityService.getAvailability(any()))
                .willThrow(new RoomNotFoundException("no-such-room"));

        mvc.perform(get("/rooms/no-such-room/availability").param("date", "2026-07-14"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
    }

    @Test
    void 必須クエリパラメータdateの欠落は400を返す_契約のrequired違反() throws Exception {
        mvc.perform(get("/rooms/room-a/availability"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void dateの形式がYYYY_MM_DDでない場合は400を返す_契約のformat違反() throws Exception {
        mvc.perform(get("/rooms/room-a/availability").param("date", "2026/07/14"))
                .andExpect(status().isBadRequest());
    }
}
