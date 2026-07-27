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
 * L3(HTTP境界・実DB): GET /rooms を実DB込みで通し、契約(RSV-L追記)のステータス・形状を検証する。
 * 契約対応: RSV-L-01(200・name昇順の一覧) / RSV-L-02(200・0件は空配列)。
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("acceptance")
class RoomListEndToEndIntegrationTest extends AbstractPostgresIntegrationTest {

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

    private ResponseEntity<String> getRooms() {
        return rest.getForEntity("/rooms", String.class);
    }

    @Test
    void RSV_L_01_登録順によらずname昇順で一覧が返る() {
        // 登録順はB→Aだが、返却順はA→Bになること(name昇順)を確認する
        roomSpringData.save(new RoomJpaEntity(
                "room-b", "会議室B", LocalTime.of(8, 0), LocalTime.of(20, 0), 10));
        roomSpringData.save(new RoomJpaEntity(
                "room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6));

        ResponseEntity<String> response = getRooms();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        assertThat(body).isNotNull();
        int indexOfA = body.indexOf("\"roomId\":\"room-a\"");
        int indexOfB = body.indexOf("\"roomId\":\"room-b\"");
        assertThat(indexOfA).isGreaterThanOrEqualTo(0);
        assertThat(indexOfB).isGreaterThan(indexOfA);
        assertThat(body)
                .contains("\"name\":\"会議室A\"")
                .contains("\"businessHoursStart\":\"09:00\"")
                .contains("\"businessHoursEnd\":\"18:00\"")
                .contains("\"capacity\":6")
                .contains("\"name\":\"会議室B\"")
                .contains("\"businessHoursStart\":\"08:00\"")
                .contains("\"businessHoursEnd\":\"20:00\"")
                .contains("\"capacity\":10")
                .doesNotContain("minReservationDurationMinutes");
    }

    @Test
    void RSV_L_02_会議室が一件も無いとき空配列のroomsが返る() {
        ResponseEntity<String> response = getRooms();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"rooms\":[]");
    }
}
