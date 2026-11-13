package com.togetherplanner.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Единственный источник «сейчас» в приложении. В тестах подменяется
 * {@code @Primary MutableClock} (spec §14.1), поэтому бизнес-код никогда не
 * обращается к {@code Instant.now()} / {@code LocalDateTime.now()} напрямую.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
