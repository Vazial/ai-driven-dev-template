package reservation.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import reservation.MutableClock;
import reservation.adapter.persistence.ReservationSpringDataRepository;
import reservation.adapter.persistence.RoomJpaEntity;
import reservation.adapter.persistence.RoomSpringDataRepository;

/**
 * L3(HTTP境界・実DB): GET /rooms/{roomId}/availability を実DB込みで通し、契約(RSV-A追記)の
 * ステータス・形状を検証する。RSV-A-06(キャンセル後は空き枠に戻る)の検証には既存のキャンセルseam
 * (PUT /test-support/clock)を使い、開始15分前の期限を満たした状態でキャンセルを成功させる。
 * 契約対応: RSV-A-01(200・全体が空き) / RSV-A-02(200・一部除外) / RSV-A-06(キャンセル後は空きに戻る) /
 * RSV-A-07(404・ROOM_NOT_FOUND)。
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("acceptance")
class RoomAvailabilityEndToEndIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private ReservationSpringDataRepository reservationSpringData;

    @Autowired
    private RoomSpringDataRepository roomSpringData;

    @Autowired
    private MutableClock clock;

    @BeforeEach
    void cleanAndPrepareRoom() {
        reservationSpringData.deleteAll();
        // roomsは他の統合テストクラス(同一Testcontainersコンテナを共有)が残す可能性があり、
        // name列のUNIQUE制約に触れないよう毎回全削除してから必要な行だけ作る
        roomSpringData.deleteAll();
        roomSpringData.save(new RoomJpaEntity(
                "room-a", "会議室A", LocalTime.of(9, 0), LocalTime.of(18, 0), 6));
        clock.reset();
    }

    private ResponseEntity<String> getAvailability(String roomId, String date) {
        return rest.getForEntity("/rooms/" + roomId + "/availability?date=" + date, String.class);
    }

    @SuppressWarnings("unchecked")
    private String createReservationAndGetId(String reserverId, String start, String end) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = """
                {
                  "roomId": "room-a",
                  "reserverId": "%s",
                  "date": "2026-07-14",
                  "startTime": "%s",
                  "endTime": "%s",
                  "attendeeCount": 2
                }
                """.formatted(reserverId, start, end);
        ResponseEntity<Map> response =
                rest.postForEntity("/reservations", new HttpEntity<>(body, headers), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return (String) response.getBody().get("reservationId");
    }

    private void setClock(String isoLocalDateTime) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Void> response = rest.exchange(
                "/test-support/clock", HttpMethod.PUT,
                new HttpEntity<>("{\"now\": \"%s\"}".formatted(isoLocalDateTime), headers), Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    private void cancel(String reservationId, String reserverId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"reserverId\": \"%s\"}".formatted(reserverId);
        ResponseEntity<String> response = rest.postForEntity(
                "/reservations/" + reservationId + "/cancel", new HttpEntity<>(body, headers), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void RSV_A_01_予約のない会議室は200で営業時間全体が空いている() {
        ResponseEntity<String> response = getAvailability("room-a", "2026-07-14");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("\"roomId\":\"room-a\"")
                .contains("\"date\":\"2026-07-14\"")
                .contains("\"startTime\":\"09:00\"")
                .contains("\"endTime\":\"18:00\"");
    }

    @Test
    void RSV_A_02_一部の時間帯に予約がある会議室は予約時間帯が空き枠から除かれる() {
        createReservationAndGetId("佐藤", "10:00", "11:00");

        ResponseEntity<String> response = getAvailability("room-a", "2026-07-14");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("\"startTime\":\"09:00\",\"endTime\":\"10:00\"")
                .contains("\"startTime\":\"11:00\",\"endTime\":\"18:00\"");
    }

    @Test
    void RSV_A_06_予約がキャンセルされた時間帯は空き枠に戻る() {
        String id = createReservationAndGetId("佐藤", "10:00", "11:00");
        setClock("2026-07-14T09:00:00");
        cancel(id, "佐藤");

        ResponseEntity<String> response = getAvailability("room-a", "2026-07-14");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("\"startTime\":\"09:00\",\"endTime\":\"18:00\"")
                .doesNotContain("\"startTime\":\"11:00\"");
    }

    @Test
    void RSV_A_07_存在しない会議室の空き枠は404でROOM_NOT_FOUNDを返す() {
        ResponseEntity<String> response = getAvailability("no-such-room", "2026-07-14");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).contains("\"code\":\"ROOM_NOT_FOUND\"");
    }
}
