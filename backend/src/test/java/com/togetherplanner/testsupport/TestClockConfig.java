package com.togetherplanner.testsupport;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Instant;
import java.time.ZoneOffset;

/**
 * Replaces the production {@code Clock} (from {@code ClockConfig}) with a
 * controllable test instance. Starts at {@code 2026-11-06T06:00:00Z} - a
 * fixed point in time makes invite expiry and refresh-token rotation
 * windows deterministic to test.
 */
@TestConfiguration
public class TestClockConfig {

    public static final Instant TEST_START_INSTANT = Instant.parse("2026-11-06T06:00:00Z");

    // Deliberately named differently from ClockConfig.clock(): two @Bean
    // methods with the same name register as two distinct beans, not an
    // override. @Primary is what breaks the tie between the two Clock
    // beans when both are present in the test context.
    @Bean
    @Primary
    public MutableClock testClock() {
        return new MutableClock(TEST_START_INSTANT, ZoneOffset.UTC);
    }
}
