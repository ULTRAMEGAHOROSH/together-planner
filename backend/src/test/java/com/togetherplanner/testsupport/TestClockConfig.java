package com.togetherplanner.testsupport;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Instant;
import java.time.ZoneOffset;

/**
 * Заменяет production {@code Clock} (из {@code ClockConfig}) управляемым
 * тестовым экземпляром. Старт — {@code 2026-11-06T06:00:00Z} (spec §14.1):
 * нужен фиксированный момент для срока действия приглашений и окна ротации
 * refresh-токенов.
 */
@TestConfiguration
public class TestClockConfig {

    public static final Instant TEST_START_INSTANT = Instant.parse("2026-11-06T06:00:00Z");

    // Имя метода намеренно отличается от ClockConfig.clock(): два @Bean-метода
    // с одинаковым именем — это конфликт регистрации (разные имена бинов),
    // а не переопределение. @Primary разрешает неоднозначность по типу между
    // двумя разными бинами Clock, когда оба присутствуют в тестовом контексте.
    @Bean
    @Primary
    public MutableClock testClock() {
        return new MutableClock(TEST_START_INSTANT, ZoneOffset.UTC);
    }
}
