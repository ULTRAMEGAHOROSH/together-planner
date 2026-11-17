package com.togetherplanner.common.time;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

/**
 * Pure, stateless time helpers. No Spring, no side effects - unit-testable
 * with no context at all.
 */
public final class TimeRules {

    private TimeRules() {
    }

    /** Monday of the week {@code date} falls in. */
    public static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /** Overlap of two half-open intervals, {@code [aStart, aEnd)} and {@code [bStart, bEnd)}. */
    public static boolean overlaps(LocalDateTime aStart, LocalDateTime aEnd,
                                    LocalDateTime bStart, LocalDateTime bEnd) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }

    /**
     * Normalizes a local time across a DST transition. A time that doesn't
     * exist is pushed forward by the length of the gap; an ambiguous time
     * keeps the earlier offset but its local value is left unchanged.
     */
    public static LocalDateTime normalize(LocalDateTime time, ZoneId zone) {
        return ZonedDateTime.of(time, zone).toLocalDateTime();
    }

    /**
     * True only if {@code zoneId} is a region id from
     * {@link ZoneId#getAvailableZoneIds()}. Rejects fixed offsets like
     * {@code "+05:00"} - they have no DST rules and no history.
     */
    public static boolean isValidRegionZone(String zoneId) {
        return ZoneId.getAvailableZoneIds().contains(zoneId);
    }
}
