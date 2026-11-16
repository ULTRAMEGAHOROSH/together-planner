package com.togetherplanner.template.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** spec §14.2: BD1–BD10. День D = {@code 2026-11-09}. */
class BusyDayRuleTest {

    private static final LocalDate D = LocalDate.of(2026, 11, 9);

    // BD1
    @Test
    void nightEventEndingBeforeNoonDoesNotMakeDBusyButMakesThePreviousDayBusy() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 8, 23, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 9, 7, 0);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isFalse();
        assertThat(BusyDayRule.makesDayBusy(D.minusDays(1), start, end)).isTrue();
    }

    // BD2
    @Test
    void eventEndingExactlyAtNoonDoesNotMakeDayBusy() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 8, 22, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 9, 12, 0);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isFalse();
    }

    // BD3
    @Test
    void eventEndingOneMinuteAfterNoonMakesDayBusy() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 8, 22, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 9, 12, 1);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isTrue();
    }

    // BD4
    @Test
    void eventEntirelyInTheMorningDoesNotMakeDayBusy() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 9, 8, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 9, 12, 0);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isFalse();
    }

    // BD5
    @Test
    void eventStartingInDAndRunningPastNoonMakesDayBusy() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 9, 11, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 9, 12, 30);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isTrue();
    }

    // BD6
    @Test
    void eventEntirelyAfterNoonMakesDayBusy() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 9, 20, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 9, 21, 0);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isTrue();
    }

    // BD7
    @Test
    void eventCrossingMidnightMakesStartDayBusyButNotTheNextDay() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 9, 23, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 10, 7, 0);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isTrue();
        assertThat(BusyDayRule.makesDayBusy(D.plusDays(1), start, end)).isFalse();
    }

    // BD8
    @Test
    void multiDayEventMakesDayBusyByIntervalOverlapNotStartDate() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 8, 8, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 10, 20, 0);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isTrue();
    }

    // BD9
    @Test
    void eventStartingExactlyAtMidnightOfTheNextDayDoesNotMakeDBusy() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 10, 0, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 10, 2, 0);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isFalse();
    }

    // BD10
    @Test
    void shortMorningEventDoesNotMakeDayBusy() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 9, 10, 0);
        LocalDateTime end = LocalDateTime.of(2026, 11, 9, 11, 0);

        assertThat(BusyDayRule.makesDayBusy(D, start, end)).isFalse();
    }
}
