package reservation.integration;

import static org.assertj.core.api.Assertions.assertThat;

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
import reservation.adapter.persistence.RoomSpringDataRepository;

/**
 * L3(seam): 受け入れテスト用seam(design.md)の検証。プロファイルacceptanceでのみ有効。
 * POST /test-support/rooms は同名なら上書き(idは維持)、DELETE /test-support/reservations は全削除。
 *
 * <p>DBはTestcontainersの単一コンテナを全統合テストクラスで共有するため(AbstractPostgresIntegrationTest)、
 * 他クラス(DoubleBookingConstraintIntegrationTest等)が投入したroomsが残っている可能性がある。
 * roomsテーブルを毎回クリーンにしてから検証する(reservationsを毎回クリーンにする他クラスと同じ方針)。</p>
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("acceptance")
class TestSupportSeamIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private RoomSpringDataRepository roomSpringData;

    @BeforeEach
    void cleanRooms() {
        roomSpringData.deleteAll();
    }

    private ResponseEntity<String> upsertRoom(String name, int capacity) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = """
                {
                  "name": "%s",
                  "businessHoursStart": "09:00",
                  "businessHoursEnd": "18:00",
                  "capacity": %d
                }
                """.formatted(name, capacity);
        return rest.postForEntity("/test-support/rooms", new HttpEntity<>(body, headers), String.class);
    }

    @Test
    void 部屋を登録でき_同名の再登録は同じidのまま設定を上書きする() {
        ResponseEntity<String> first = upsertRoom("会議室A", 6);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(first.getBody()).contains("\"roomId\"").contains("\"capacity\":6");

        ResponseEntity<String> second = upsertRoom("会議室A", 10);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(second.getBody()).contains("\"capacity\":10");

        assertThat(roomSpringData.findByName("会議室A"))
                .hasValueSatisfying(room -> assertThat(room.getCapacity()).isEqualTo(10));
        assertThat(roomSpringData.count()).isEqualTo(1);
    }

    @Test
    void 全予約を削除できる() {
        ResponseEntity<Void> response = rest.exchange(
                "/test-support/reservations", HttpMethod.DELETE, HttpEntity.EMPTY, Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void 全会議室を削除でき_会議室が一件も存在しない状態になる() {
        upsertRoom("会議室A", 6);

        ResponseEntity<Void> response = rest.exchange(
                "/test-support/rooms", HttpMethod.DELETE, HttpEntity.EMPTY, Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(roomSpringData.count()).isEqualTo(0);
    }
}
