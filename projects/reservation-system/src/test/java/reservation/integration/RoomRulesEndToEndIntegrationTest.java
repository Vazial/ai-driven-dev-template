package reservation.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import reservation.adapter.persistence.ReservationSpringDataRepository;
import reservation.adapter.persistence.RoomJpaEntity;
import reservation.adapter.persistence.RoomSpringDataRepository;

/**
 * L3(HTTP境界・実DB): GET /rooms/{roomId}/rules を実DB込みで通し、契約(RSV-R追記)の
 * ステータス・形状を検証する。
 * 契約対応: RSV-R-01(200・営業時間/定員/最小予約時間) / RSV-R-02(200・別会議室でも最小予約時間は共通) /
 * RSV-R-03(404・ROOM_NOT_FOUND)。
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("acceptance")
class RoomRulesEndToEndIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private ReservationSpringDataRepository reservationSpringData;

    @Autowired
    private RoomSpringDataRepository roomSpringData;

    @BeforeEach
    void cleanAndPrepareRooms() {
        // roomsは他の統合テストクラス(同一Testcontainersコンテナを共有)が残す可能性があり、
        // name列のUNIQUE制約に触れないよう毎回全削除してから必要な行だけ作る
        reservationSpringData.deleteAll();
        roomSpringData.deleteAll();
        roomSpringData.save(new RoomJpaEntity(
                "room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6));
        roomSpringData.save(new RoomJpaEntity(
                "room-b", "会議室B", LocalTime.of(8, 0), LocalTime.of(20, 0), 10));
    }

    private ResponseEntity<String> getRules(String roomId) {
        return rest.getForEntity("/rooms/" + roomId + "/rules", String.class);
    }

    @Test
    void RSV_R_01_会議室の予約ルールを確認する() {
        ResponseEntity<String> response = getRules("room-a");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("\"roomId\":\"room-a\"")
                .contains("\"businessHoursStart\":\"09:00\"")
                .contains("\"businessHoursEnd\":\"18:00\"")
                .contains("\"capacity\":6")
                .contains("\"minReservationDurationMinutes\":30");
    }

    @Test
    void RSV_R_02_別の会議室の予約ルールを確認する() {
        ResponseEntity<String> response = getRules("room-b");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("\"roomId\":\"room-b\"")
                .contains("\"businessHoursStart\":\"08:00\"")
                .contains("\"businessHoursEnd\":\"20:00\"")
                .contains("\"capacity\":10")
                .contains("\"minReservationDurationMinutes\":30");
    }

    @Test
    void RSV_R_03_存在しない会議室の予約ルールは404でROOM_NOT_FOUNDを返す() {
        ResponseEntity<String> response = getRules("no-such-room");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).contains("\"code\":\"ROOM_NOT_FOUND\"");
    }
}
