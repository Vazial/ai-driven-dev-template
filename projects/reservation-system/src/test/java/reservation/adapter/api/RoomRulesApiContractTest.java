package reservation.adapter.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import reservation.application.GetRoomRulesQuery;
import reservation.application.RoomNotFoundException;
import reservation.application.RoomRules;
import reservation.application.RoomRulesService;

/**
 * L3: GET /rooms/{roomId}/rules のレスポンスが契約(contracts/reservation-api.yaml RSV-R追記)と
 * 一致することの検証。DB不要(ユースケースをモック)。ステータスコード(200/404)・レスポンス形状を固定する。
 */
@WebMvcTest(RoomRulesController.class)
class RoomRulesApiContractTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private RoomRulesService roomRulesService;

    @Test
    void RSV_R_01_予約ルール取得成功は200で_契約のRoomRulesResponse形状を返す() throws Exception {
        given(roomRulesService.getRules(new GetRoomRulesQuery("room-a")))
                .willReturn(new RoomRules(LocalTime.of(9, 0), LocalTime.of(18, 0), 6, 30));

        mvc.perform(get("/rooms/room-a/rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("room-a"))
                .andExpect(jsonPath("$.businessHoursStart").value("09:00"))
                .andExpect(jsonPath("$.businessHoursEnd").value("18:00"))
                .andExpect(jsonPath("$.capacity").value(6))
                .andExpect(jsonPath("$.minReservationDurationMinutes").value(30));

        then(roomRulesService).should().getRules(new GetRoomRulesQuery("room-a"));
    }

    @Test
    void RSV_R_02_別の会議室でも最小予約時間は同じ値が返る() throws Exception {
        given(roomRulesService.getRules(new GetRoomRulesQuery("room-b")))
                .willReturn(new RoomRules(LocalTime.of(8, 0), LocalTime.of(20, 0), 10, 30));

        mvc.perform(get("/rooms/room-b/rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("room-b"))
                .andExpect(jsonPath("$.businessHoursStart").value("08:00"))
                .andExpect(jsonPath("$.businessHoursEnd").value("20:00"))
                .andExpect(jsonPath("$.capacity").value(10))
                .andExpect(jsonPath("$.minReservationDurationMinutes").value(30));
    }

    @Test
    void RSV_R_03_存在しない会議室は404で_理由コードROOM_NOT_FOUNDを返す() throws Exception {
        given(roomRulesService.getRules(any()))
                .willThrow(new RoomNotFoundException("no-such-room"));

        mvc.perform(get("/rooms/no-such-room/rules"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROOM_NOT_FOUND"));
    }
}
