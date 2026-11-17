package com.togetherplanner.common.time;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * "Now" through an injected {@link Clock} rather than calling
 * {@code LocalDateTime.now()} directly, so tests can swap in a fixed clock.
 */
@Service
@RequiredArgsConstructor
public class TimeService {

    private final Clock clock;

    public LocalDateTime now(ZoneId zone) {
        return LocalDateTime.now(clock.withZone(zone));
    }

    public LocalDate today(ZoneId zone) {
        return LocalDate.now(clock.withZone(zone));
    }

    public Instant nowInstant() {
        return clock.instant();
    }
}
