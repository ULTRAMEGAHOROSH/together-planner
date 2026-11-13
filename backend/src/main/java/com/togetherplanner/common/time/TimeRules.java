package com.togetherplanner.common.time;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

/**
 * Статические чистые функции над временем (spec §3, §9.3). Без Spring,
 * без побочных эффектов — проверяются unit-тестами без контекста.
 */
public final class TimeRules {

    private TimeRules() {
    }

    /** Понедельник недели, которой принадлежит {@code date}. */
    public static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /**
     * Пересечение двух полуоткрытых интервалов {@code [aStart; aEnd)} и
     * {@code [bStart; bEnd)} (spec §3, правило 4).
     */
    public static boolean overlaps(LocalDateTime aStart, LocalDateTime aEnd,
                                    LocalDateTime bStart, LocalDateTime bEnd) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }

    /**
     * Нормализация местного времени относительно перехода на летнее/зимнее
     * время (spec §3, правило 2). Несуществующее время сдвигается вперёд на
     * длину разрыва; неоднозначное время берёт более раннее смещение, но
     * сохраняет исходное локальное значение.
     */
    public static LocalDateTime normalize(LocalDateTime time, ZoneId zone) {
        return ZonedDateTime.of(time, zone).toLocalDateTime();
    }

    /**
     * {@code true}, только если {@code zoneId} — region-id из
     * {@link ZoneId#getAvailableZoneIds()}. Отклоняет фиксированные смещения
     * вида {@code "+05:00"} (A-18): у них нет правил DST и истории изменений.
     */
    public static boolean isValidRegionZone(String zoneId) {
        return ZoneId.getAvailableZoneIds().contains(zoneId);
    }
}
