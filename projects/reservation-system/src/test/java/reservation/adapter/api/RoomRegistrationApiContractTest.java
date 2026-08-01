package reservation.adapter.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import reservation.application.RegisterRoomCommand;
import reservation.application.RoomRegistrationService;
import reservation.domain.Room;
import reservation.domain.RoomRejectedException;
import reservation.domain.RoomRejectionReason;

/**
 * L3: POST /rooms のレスポンスが契約(contracts/reservation-api.yaml RSV-T追記)と一致することの検証。
 * DB不要(ユースケースをモック)。ステータスコード(201/409/422/400)・レスポンス形状・理由コードを固定する。
 */
@WebMvcTest(RoomRegistrationController.class)
class RoomRegistrationApiContractTest {

    private static final String VALID_REQUEST = """
            {
              "name": "会議室C",
              "businessHoursStart": "09:00",
              "businessHoursEnd": "18:00",
              "capacity": 8
            }
            """;

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private RoomRegistrationService roomRegistrationService;

    private ResultActions postRoom(String body) throws Exception {
        return mvc.perform(post("/rooms")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    @Test
    void RSV_T_01_登録成功は201で_契約のRoomSummary形状を返す() throws Exception {
        Room registered = new Room("room-c", "会議室C", LocalTime.of(9, 0), LocalTime.of(18, 0), 8);
        given(roomRegistrationService.register(any())).willReturn(registered);

        postRoom(VALID_REQUEST)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roomId").value("room-c"))
                .andExpect(jsonPath("$.name").value("会議室C"))
                .andExpect(jsonPath("$.businessHoursStart").value("09:00"))
                .andExpect(jsonPath("$.businessHoursEnd").value("18:00"))
                .andExpect(jsonPath("$.capacity").value(8));

        // リクエストがそのままユースケース入力に詰め替えられること
        then(roomRegistrationService).should().register(new RegisterRoomCommand(
                "会議室C", LocalTime.of(9, 0), LocalTime.of(18, 0), 8));
    }

    @Test
    void RSV_T_02_表示名の重複は409で_理由コードROOM_NAME_DUPLICATEを返す() throws Exception {
        given(roomRegistrationService.register(any()))
                .willThrow(new RoomRejectedException(RoomRejectionReason.ROOM_NAME_DUPLICATE));

        postRoom(VALID_REQUEST)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ROOM_NAME_DUPLICATE"))
                .andExpect(jsonPath("$.message").value("同じ名前の会議室が既に存在します"));
    }

    @Test
    void RSV_T_03_04_営業時間が成立しない場合は422で_理由コードINVALID_BUSINESS_HOURSを返す() throws Exception {
        given(roomRegistrationService.register(any()))
                .willThrow(new RoomRejectedException(RoomRejectionReason.INVALID_BUSINESS_HOURS));

        postRoom(VALID_REQUEST)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_BUSINESS_HOURS"))
                .andExpect(jsonPath("$.message").value("営業時間の終了時刻は開始時刻より後でなければなりません"));
    }

    @Test
    void 必須フィールドの欠落は400を返す_契約のrequired違反() throws Exception {
        postRoom("{\"name\": \"会議室C\"}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void 時刻形式がHH_mmでない場合は400を返す_契約のpattern違反() throws Exception {
        postRoom("""
                {
                  "name": "会議室C",
                  "businessHoursStart": "9時",
                  "businessHoursEnd": "18:00",
                  "capacity": 8
                }
                """)
                .andExpect(status().isBadRequest());
    }

    @Test
    void 定員が1未満の場合は400を返す_契約のminimum違反() throws Exception {
        postRoom("""
                {
                  "name": "会議室C",
                  "businessHoursStart": "09:00",
                  "businessHoursEnd": "18:00",
                  "capacity": 0
                }
                """)
                .andExpect(status().isBadRequest());
    }
}
