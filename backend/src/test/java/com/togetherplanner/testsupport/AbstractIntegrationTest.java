package com.togetherplanner.testsupport;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Базовый класс всех {@code *IT} (spec §14.1). Один контейнер PostgreSQL на
 * весь прогон тестов (статическое поле — Spring кеширует контекст между
 * тестовыми классами с одинаковой конфигурацией). На тестовых классах нет
 * {@code @Transactional}: запросы через {@link MockMvc} должны коммитить,
 * как в реальности — иначе проверки гонок (этап 9) были бы бессмысленны.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Testcontainers
public abstract class AbstractIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

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
