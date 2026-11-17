package com.togetherplanner.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * The only source of "now" in the app. Tests swap in a {@code @Primary}
 * {@code MutableClock}, so business code never calls {@code Instant.now()}
 * / {@code LocalDateTime.now()} directly.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
