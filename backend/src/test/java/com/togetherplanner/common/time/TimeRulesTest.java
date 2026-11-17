package com.togetherplanner.common.time;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class TimeRulesTest {

    // TR1
    @ParameterizedTest
    @ValueSource(strings = {"2026-11-09", "2026-11-12", "2026-11-15"})
    void weekStartAlwaysReturnsMonday(String date) {
        assertThat(TimeRules.weekStart(LocalDate.parse(date))).isEqualTo(LocalDate.of(2026, 11, 9));
    }

    // TR2
    @Test
    void adjacentIntervalsDoNotOverlap() {
        boolean result = TimeRules.overlaps(
                dt("09:00"), dt("10:00"),
                dt("10:00"), dt("11:00"));
        assertThat(result).isFalse();
    }

    // TR3
    @Test
    void genuinelyOverlappingIntervalsOverlap() {
        boolean result = TimeRules.overlaps(
                dt("09:00"), dt("10:30"),
                dt("10:00"), dt("11:00"));
        assertThat(result).isTrue();
    }

    // TR4
    @Test
    void nonExistentTimeIsShiftedForwardByGapLength() {
        LocalDateTime result = TimeRules.normalize(
                LocalDateTime.of(2026, 3, 29, 2, 30), ZoneId.of("Europe/Berlin"));
        assertThat(result).isEqualTo(LocalDateTime.of(2026, 3, 29, 3, 30));
    }

    // TR5
    @Test
    void ambiguousTimeIsKeptUnchanged() {
        LocalDateTime result = TimeRules.normalize(
                LocalDateTime.of(2026, 10, 25, 2, 30), ZoneId.of("Europe/Berlin"));
        assertThat(result).isEqualTo(LocalDateTime.of(2026, 10, 25, 2, 30));
    }

    // TR6
    @Test
    void onlyRegionIdsAreValidTimeZones() {
        assertThat(TimeRules.isValidRegionZone("Asia/Almaty")).isTrue();
        assertThat(TimeRules.isValidRegionZone("+05:00")).isFalse();
        assertThat(TimeRules.isValidRegionZone("Mars/Base")).isFalse();
    }

    private static LocalDateTime dt(String time) {
        return LocalDateTime.of(2026, 11, 9, 0, 0).with(java.time.LocalTime.parse(time));
    }
}
