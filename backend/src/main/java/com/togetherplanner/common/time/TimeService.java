package com.togetherplanner.common.time;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** "Now" through an injected {@link Clock} rather than calling {@code LocalDateTime.now()} directly, so tests can swap in a fixed clock. */
public interface TimeService {

    LocalDateTime now(ZoneId zone);

    LocalDate today(ZoneId zone);

    Instant nowInstant();
}
