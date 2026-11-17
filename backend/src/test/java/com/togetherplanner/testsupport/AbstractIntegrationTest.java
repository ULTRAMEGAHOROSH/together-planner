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
 * Base class for every {@code *IT}. One PostgreSQL container for the
 * whole test run - not through {@code @Testcontainers}/{@code @Container},
 * since those annotations only share a static field within a single test
 * class and stop the container in {@code afterAll} between classes
 * (Testcontainers itself documents this as a known limitation). Starting
 * it in a static initializer, with no JUnit annotations at all, is the
 * documented way to get one container for the whole run; Ryuk tears it
 * down when the JVM exits. Spring caches the {@code ApplicationContext}
 * across classes with the same configuration anyway, so the context
 * itself is shared regardless.
 *
 * <p>No {@code @Transactional} on test classes: requests through
 * {@link MockMvc} need to actually commit, the way they would in
 * production, or the concurrency tests would be testing nothing.
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
    protected TestApi testApi;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @BeforeEach
    void resetDatabaseAndClock() {
        databaseCleaner.clean();
        clock.setInstant(TestClockConfig.TEST_START_INSTANT);
    }
}
