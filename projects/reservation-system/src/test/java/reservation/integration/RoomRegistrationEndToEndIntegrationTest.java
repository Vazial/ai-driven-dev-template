package reservation.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import reservation.adapter.persistence.ReservationSpringDataRepository;
import reservation.adapter.persistence.RoomJpaEntity;
import reservation.adapter.persistence.RoomSpringDataRepository;

/**
 * L3(HTTP境界・実DB): POST /rooms を実DB込みで通し、契約(RSV-T追記)のステータス・形状を検証する。
 * 契約対応: RSV-T-01(201) / RSV-T-02(409) / RSV-T-03/04(422)。
 * acceptanceプロファイルを指定しない(adr/0008の発端: 通常起動でも会議室を登録できることを確認する)。
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RoomRegistrationEndToEndIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private ReservationSpringDataRepository reservationSpringData;

    @Autowired
    private RoomSpringDataRepository roomSpringData;

    @BeforeEach
    void cleanRooms() {
        // roomsは他の統合テストクラス(同一Testcontainersコンテナを共有)が残す可能性があり、
        // name列のUNIQUE制約に触れないよう毎回全削除してから必要な行だけ作る
        reservationSpringData.deleteAll();
        roomSpringData.deleteAll();
    }

    private ResponseEntity<String> postRoom(String name, String start, String end, int capacity) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = """
                {
                  "name": "%s",
                  "businessHoursStart": "%s",
                  "businessHoursEnd": "%s",
                  "capacity": %d
                }
                """.formatted(name, start, end, capacity);
        return rest.postForEntity("/rooms", new HttpEntity<>(body, headers), String.class);
    }

    @Test
    void RSV_T_01_会議室を登録でき_201で契約の形状を返し_一覧に反映される() {
        ResponseEntity<String> response = postRoom("会議室C", "09:00", "18:00", 8);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String body = response.getBody();
        assertThat(body)
                .isNotNull()
                .contains("\"roomId\"")
                .contains("\"name\":\"会議室C\"")
                .contains("\"businessHoursStart\":\"09:00\"")
                .contains("\"businessHoursEnd\":\"18:00\"")
                .contains("\"capacity\":8");
        assertThat(roomSpringData.findByName("会議室C")).isPresent();
    }

    @Test
    void RSV_T_02_既に存在する表示名は409でROOM_NAME_DUPLICATEを返す() {
        roomSpringData.save(new RoomJpaEntity(
                "room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6));

        ResponseEntity<String> response = postRoom("会議室A", "08:00", "20:00", 10);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).contains("\"code\":\"ROOM_NAME_DUPLICATE\"");
        assertThat(roomSpringData.findAll()).hasSize(1);
    }

    @Test
    void RSV_T_03_終了が開始より前の営業時間は422でINVALID_BUSINESS_HOURSを返す() {
        ResponseEntity<String> response = postRoom("会議室D", "18:00", "09:00", 6);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).contains("\"code\":\"INVALID_BUSINESS_HOURS\"");
        assertThat(roomSpringData.findAll()).isEmpty();
    }

    @Test
    void RSV_T_04_終了と開始が同時刻の営業時間は422でINVALID_BUSINESS_HOURSを返す() {
        ResponseEntity<String> response = postRoom("会議室D", "09:00", "09:00", 6);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).contains("\"code\":\"INVALID_BUSINESS_HOURS\"");
        assertThat(roomSpringData.findAll()).isEmpty();
    }
}
