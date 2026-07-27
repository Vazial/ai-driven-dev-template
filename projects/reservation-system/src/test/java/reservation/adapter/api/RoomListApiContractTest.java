package reservation.adapter.api;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import reservation.application.RoomListService;
import reservation.domain.Room;

/**
 * L3: GET /rooms のレスポンスが契約(contracts/reservation-api.yaml RSV-L追記)と一致することの検証。
 * DB不要(ユースケースをモック)。ステータスコード(200)・レスポンス形状(rooms配列・
 * minReservationDurationMinutesを含まないこと)を固定する。
 */
@WebMvcTest(RoomListController.class)
class RoomListApiContractTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private RoomListService roomListService;

    @Test
    void RSV_L_01_複数の会議室が契約のRoomListResponse形状でname昇順に返る() throws Exception {
        given(roomListService.listRooms()).willReturn(List.of(
                new Room("room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6),
                new Room("room-b", "会議室B", LocalTime.of(8, 0), LocalTime.of(20, 0), 10)));

        mvc.perform(get("/rooms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rooms.length()").value(2))
                .andExpect(jsonPath("$.rooms[0].roomId").value("room-a"))
                .andExpect(jsonPath("$.rooms[0].name").value("会議室A"))
                .andExpect(jsonPath("$.rooms[0].businessHoursStart").value("09:00"))
                .andExpect(jsonPath("$.rooms[0].businessHoursEnd").value("18:00"))
                .andExpect(jsonPath("$.rooms[0].capacity").value(6))
                .andExpect(jsonPath("$.rooms[0].minReservationDurationMinutes").doesNotExist())
                .andExpect(jsonPath("$.rooms[1].roomId").value("room-b"))
                .andExpect(jsonPath("$.rooms[1].name").value("会議室B"))
                .andExpect(jsonPath("$.rooms[1].businessHoursStart").value("08:00"))
                .andExpect(jsonPath("$.rooms[1].businessHoursEnd").value("20:00"))
                .andExpect(jsonPath("$.rooms[1].capacity").value(10))
                .andExpect(jsonPath("$.rooms[1].minReservationDurationMinutes").doesNotExist());

        then(roomListService).should().listRooms();
    }

    @Test
    void RSV_L_02_会議室が一件も無いとき空配列のroomsが返る() throws Exception {
        given(roomListService.listRooms()).willReturn(List.of());

        mvc.perform(get("/rooms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rooms").isArray())
                .andExpect(jsonPath("$.rooms.length()").value(0));
    }
}
