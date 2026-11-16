package com.togetherplanner.event.service;

import java.time.LocalDateTime;

/** Результат {@link EventValidator#normalizeAndValidateTimes}: уже обрезанные до минут и нормализованные по DST. */
public record ValidatedEventTimes(LocalDateTime start, LocalDateTime end) {
}
