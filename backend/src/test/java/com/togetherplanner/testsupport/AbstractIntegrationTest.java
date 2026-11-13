package com.togetherplanner.testsupport;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Базовый класс всех {@code *IT} (spec §14.1). Один контейнер PostgreSQL на
 * весь прогон тестов — не через {@code @Testcontainers}/{@code @Container}:
 * эти аннотации делят статическое поле только в пределах ОДНОГО тестового
 * класса, а между классами каждый {@code afterAll} его останавливает (сам
 * Testcontainers документирует это как известное ограничение). Для общего
 * на весь прогон контейнера официальный приём — запуск в статическом
 * инициализаторе, без JUnit5-аннотаций вообще; закрывает его Ryuk при
 * завершении JVM. Spring кеширует {@code ApplicationContext} между классами
 * с одинаковой конфигурацией, так что сам Spring-контекст всё равно один.
 *
 * <p>На тестовых классах нет {@code @Transactional}: запросы через
 * {@link MockMvc} должны коммитить, как в реальности — иначе проверки
 * гонок (этап 9) были бы бессмысленны.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
public abstract class AbstractIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

    static {
        POSTGRES.start();
    }

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected MutableClock clock;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @BeforeEach
    void resetDatabaseAndClock() {
        databaseCleaner.clean();
        clock.setInstant(TestClockConfig.TEST_START_INSTANT);
    }
}
