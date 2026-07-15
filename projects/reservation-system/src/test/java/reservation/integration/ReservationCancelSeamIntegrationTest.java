package reservation.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
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
 * L3(HTTP境界・実DB・seam): POST /reservations/{reservationId}/cancel を実DB込みで通し、
 * 契約(RSV-K)のステータス・形状を検証する。PUT /test-support/clockで現在時刻を固定し、
 * 開始15分前の境界(RSV-K-04〜07)とキャンセル後の再予約(RSV-K-03)をHTTP経由で確かめる。
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("acceptance")
class ReservationCancelSeamIntegrationTest extends AbstractPostgresIntegrationTest {

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

    private void setClock(String isoLocalDateTime) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Void> response = rest.exchange(
                "/test-support/clock", HttpMethod.PUT,
                new HttpEntity<>("{\"now\": \"%s\"}".formatted(isoLocalDateTime), headers), Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
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

    private ResponseEntity<String> cancel(String reservationId, String reserverId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"reserverId\": \"%s\"}".formatted(reserverId);
        return rest.postForEntity(
                "/reservations/" + reservationId + "/cancel", new HttpEntity<>(body, headers), String.class);
    }

    @Test
    void RSV_K_01_開始15分前ちょうどなら本人のキャンセルは200で契約の形状を返す() {
        String id = createReservationAndGetId("佐藤", "10:00", "11:00");
        setClock("2026-07-14T09:45:00");

        ResponseEntity<String> response = cancel(id, "佐藤");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("\"reservationId\":\"" + id + "\"")
                .contains("\"reserverId\":\"佐藤\"")
                .contains("\"cancelledAt\"");
    }

    @Test
    void RSV_K_02_本人以外のキャンセルは403でNOT_RESERVERを返す() {
        String id = createReservationAndGetId("佐藤", "10:00", "11:00");
        setClock("2026-07-14T09:00:00");

        ResponseEntity<String> response = cancel(id, "鈴木");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).contains("\"code\":\"NOT_RESERVER\"");
    }

    @Test
    void RSV_K_03_キャンセル後は同じ時間帯に新しい予約を作成できる() {
        String id = createReservationAndGetId("佐藤", "10:00", "11:00");
        setClock("2026-07-14T09:00:00");
        assertThat(cancel(id, "佐藤").getStatusCode()).isEqualTo(HttpStatus.OK);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = """
                {
                  "roomId": "room-a",
                  "reserverId": "鈴木",
                  "date": "2026-07-14",
                  "startTime": "10:00",
                  "endTime": "11:00",
                  "attendeeCount": 2
                }
                """;
        ResponseEntity<String> response =
                rest.postForEntity("/reservations", new HttpEntity<>(body, headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).contains("\"reserverId\":\"鈴木\"");
    }

    @Test
    void RSV_K_06_開始14分前のキャンセルは422でCANCEL_DEADLINE_PASSEDを返す() {
        String id = createReservationAndGetId("佐藤", "10:00", "11:00");
        setClock("2026-07-14T09:46:00");

        ResponseEntity<String> response = cancel(id, "佐藤");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).contains("\"code\":\"CANCEL_DEADLINE_PASSED\"");
    }

    @Test
    void RSV_K_07_開始後のキャンセルは422でCANCEL_DEADLINE_PASSEDを返す() {
        String id = createReservationAndGetId("佐藤", "10:00", "11:00");
        setClock("2026-07-14T10:15:00");

        ResponseEntity<String> response = cancel(id, "佐藤");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody()).contains("\"code\":\"CANCEL_DEADLINE_PASSED\"");
    }

    @Test
    void RSV_K_08_既にキャンセル済みの予約の再キャンセルは409でALREADY_CANCELLEDを返す() {
        String id = createReservationAndGetId("佐藤", "10:00", "11:00");
        setClock("2026-07-14T09:00:00");
        assertThat(cancel(id, "佐藤").getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> response = cancel(id, "佐藤");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).contains("\"code\":\"ALREADY_CANCELLED\"");
    }

    @Test
    void RSV_K_09_存在しない予約のキャンセルは404でRESERVATION_NOT_FOUNDを返す() {
        ResponseEntity<String> response = cancel("11111111-1111-1111-1111-111111111111", "佐藤");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).contains("\"code\":\"RESERVATION_NOT_FOUND\"");
    }

    @Test
    void DELETE_test_support_reservationsの実行時に固定した時刻が実時刻へリセットされる() {
        setClock("2000-01-01T00:00:00");
        assertThat(Instant.now(clock)).isBefore(Instant.parse("2001-01-01T00:00:00Z"));

        ResponseEntity<Void> response = rest.exchange(
                "/test-support/reservations", HttpMethod.DELETE, HttpEntity.EMPTY, Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(Instant.now(clock)).isAfter(Instant.parse("2025-01-01T00:00:00Z"));
    }
}
