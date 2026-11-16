package com.togetherplanner.template.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Бизнес-правило FILL: когда день считается занятым для участника (spec
 * §9.1, Д D-4, решение Q-1). Единственное место, где задан порог 12:00.
 */
public final class BusyDayRule {

    /** День занят, если событие пересекает интервал {@code [день BUSY_FROM; следующий день 00:00)}. */
    public static final LocalTime BUSY_FROM = LocalTime.NOON;

    public static boolean makesDayBusy(LocalDate day, LocalDateTime start, LocalDateTime end) {
        LocalDateTime from = day.atTime(BUSY_FROM);
        LocalDateTime to = day.plusDays(1).atStartOfDay();
        return start.isBefore(to) && end.isAfter(from);     // полуоткрытые интервалы (§3, правило 4)
    }

    private BusyDayRule() {
    }
}
