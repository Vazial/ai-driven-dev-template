package reservation.integration;

import static org.assertj.core.api.Assertions.assertThat;

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

/**
 * L3(seam): プロファイルacceptance無しの構成ではtest-support seamが存在しないこと(design.md)。
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TestSupportDisabledInProductionIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Test
    void 本番構成ではtest_supportのエンドポイントが存在しない() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> post = rest.postForEntity(
                "/test-support/rooms",
                new HttpEntity<>("{\"name\":\"x\",\"businessHoursStart\":\"09:00\","
                        + "\"businessHoursEnd\":\"18:00\",\"capacity\":1}", headers),
                String.class);
        assertThat(post.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        ResponseEntity<Void> delete = rest.exchange(
                "/test-support/reservations", HttpMethod.DELETE, HttpEntity.EMPTY, Void.class);
        assertThat(delete.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        // RSV-K追記: 時刻固定seam(PUT /test-support/clock)も本番構成には存在しない
        ResponseEntity<Void> put = rest.exchange(
                "/test-support/clock", HttpMethod.PUT,
                new HttpEntity<>("{\"now\":\"2026-07-14T09:45:00\"}", headers), Void.class);
        assertThat(put.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
