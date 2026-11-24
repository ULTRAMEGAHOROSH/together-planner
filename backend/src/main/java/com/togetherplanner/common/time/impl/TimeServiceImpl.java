package com.togetherplanner.common.time.impl;

import com.togetherplanner.common.time.TimeService;
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
public class TimeServiceImpl implements TimeService {

    private final Clock clock;

    @Override
    public LocalDateTime now(ZoneId zone) {
        return LocalDateTime.now(clock.withZone(zone));
    }

    @Override
    public LocalDate today(ZoneId zone) {
        return LocalDate.now(clock.withZone(zone));
    }

    @Override
    public Instant nowInstant() {
        return clock.instant();
    }
}
