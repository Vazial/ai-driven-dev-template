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
 * L3(HTTP境界・実DB): POST /reservations を実DB込みで通し、契約のステータス・形状を検証する。
 * 契約対応: RSV-C-01(201) / RSV-C-02(409)。
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ReservationApiEndToEndIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private ReservationSpringDataRepository reservationSpringData;

    @Autowired
    private RoomSpringDataRepository roomSpringData;

    @BeforeEach
    void cleanAndPrepareRoom() {
        reservationSpringData.deleteAll();
        // roomsは他の統合テストクラス(同一Testcontainersコンテナを共有)が残す可能性があり、
        // name列のUNIQUE制約に触れないよう毎回全削除してから必要な行だけ作る
        roomSpringData.deleteAll();
        roomSpringData.save(new RoomJpaEntity(
                "room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6));
    }

    private ResponseEntity<String> postReservation(String reserverId, String start, String end) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = """
                {
                  "roomId": "room-a",
                  "reserverId": "%s",
                  "date": "2026-07-14",
                  "startTime": "%s",
                  "endTime": "%s",
                  "attendeeCount": 4
                }
                """.formatted(reserverId, start, end);
        return rest.postForEntity("/reservations", new HttpEntity<>(body, headers), String.class);
    }

    @Test
    void RSV_C_01_空いている時間帯への予約は201で契約の形状を返す() {
        ResponseEntity<String> response = postReservation("佐藤", "10:00", "11:00");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody())
                .contains("\"reservationId\"")
                .contains("\"roomId\":\"room-a\"")
                .contains("\"reserverId\":\"佐藤\"")
                .contains("\"date\":\"2026-07-14\"")
                .contains("\"startTime\":\"10:00\"")
                .contains("\"endTime\":\"11:00\"")
                .contains("\"attendeeCount\":4");
    }

    @Test
    void RSV_C_02_重なる時間帯への予約は409でTIME_SLOT_CONFLICTを返す() {
        postReservation("佐藤", "10:00", "11:00");

        ResponseEntity<String> response = postReservation("鈴木", "10:30", "11:30");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).contains("\"code\":\"TIME_SLOT_CONFLICT\"");
    }
}
