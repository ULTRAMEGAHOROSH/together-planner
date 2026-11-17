package com.togetherplanner.template.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * FILL's rule for when a day counts as busy for a participant. The only
 * place the 12:00 threshold is defined.
 */
public final class BusyDayRule {

    /** A day is busy if an event overlaps {@code [day BUSY_FROM, next day 00:00)}. */
    public static final LocalTime BUSY_FROM = LocalTime.NOON;

    public static boolean makesDayBusy(LocalDate day, LocalDateTime start, LocalDateTime end) {
        LocalDateTime from = day.atTime(BUSY_FROM);
        LocalDateTime to = day.plusDays(1).atStartOfDay();
        return start.isBefore(to) && end.isAfter(from);     // half-open intervals
    }

    private BusyDayRule() {
    }
}
