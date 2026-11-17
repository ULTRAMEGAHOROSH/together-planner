package com.togetherplanner.event.service;

import java.time.LocalDateTime;

/** Result of {@link EventValidator#normalizeAndValidateTimes} - already minute-truncated and DST-normalized. */
public record ValidatedEventTimes(LocalDateTime start, LocalDateTime end) {
}
