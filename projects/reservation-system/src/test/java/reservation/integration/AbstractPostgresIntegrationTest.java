package reservation.integration;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * PostgreSQL(Testcontainers)を使う統合テストの基底。
 * 排他制約はPostgreSQL固有機能のためテストは実DBで行う(design.md DB選定)。
 * コンテナ実行環境(Podman/Docker互換API)が無い場合はassumptionで明示的にskipされる。
 * skipされた場合、この検証は「実行されていない」。緑と混同しないこと。
 */
@Tag("integration")
public abstract class AbstractPostgresIntegrationTest {

    private static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @BeforeAll
    static void requireContainerRuntime() {
        Assumptions.assumeTrue(
                isContainerRuntimeAvailable(),
                "コンテナ実行環境が利用できないためskip(PostgreSQLの排他制約はコンテナ上の実DBでのみ検証できる)");
        if (!POSTGRES.isRunning()) {
            POSTGRES.start();
        }
    }

    private static boolean isContainerRuntimeAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (RuntimeException e) {
            return false;
        }
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
