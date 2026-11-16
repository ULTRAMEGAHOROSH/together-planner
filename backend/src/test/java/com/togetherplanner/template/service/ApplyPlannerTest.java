package com.togetherplanner.template.service;

import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.dto.EventSourceResponse;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.template.dto.ApplyPlan;
import com.togetherplanner.template.dto.PlanInput;
import com.togetherplanner.template.dto.PlannedEvent;
import com.togetherplanner.template.dto.TemplateEventResponse;
import com.togetherplanner.template.entity.ApplyMode;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * spec §14.2: вся общая фикстура {@code ApplyPlanner} — M1–M8, F1–F10, R1–R8
 * (26 кейсов), на одной неделе W = 2026-11-09 (пн) – 2026-11-15 (вс),
 * участники A и B, пояс Asia/Almaty, шаблон T «Обычная неделя».
 */
class ApplyPlannerTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Almaty");
    private static final LocalDate WEEK_START = LocalDate.of(2026, 11, 9);

    private static final LocalDateTime T1_START = LocalDateTime.of(2026, 11, 9, 9, 0);
    private static final LocalDateTime T1_END = LocalDateTime.of(2026, 11, 9, 13, 0);
    private static final LocalDateTime T2_START = LocalDateTime.of(2026, 11, 9, 23, 0);
    private static final LocalDateTime T2_END = LocalDateTime.of(2026, 11, 10, 7, 0);
    private static final LocalDateTime T3_START = LocalDateTime.of(2026, 11, 13, 19, 0);
    private static final LocalDateTime T3_END = LocalDateTime.of(2026, 11, 13, 21, 0);
    private static final LocalDateTime T4_START = LocalDateTime.of(2026, 11, 15, 23, 0);
    private static final LocalDateTime T4_END = LocalDateTime.of(2026, 11, 16, 7, 0);

    private final UUID userA = UUID.randomUUID();
    private final UUID userB = UUID.randomUUID();
    private final UUID t1Id = UUID.randomUUID();
    private final UUID t2Id = UUID.randomUUID();
    private final UUID t3Id = UUID.randomUUID();
    private final UUID t4Id = UUID.randomUUID();
    private final UUID e1Id = UUID.randomUUID();
    private final UUID e2Id = UUID.randomUUID();
    private final UUID e3Id = UUID.randomUUID();
    private final UUID e4Id = UUID.randomUUID();

    private final ApplyPlanner planner = new ApplyPlanner();

    // ---------------------------------------------------------------- MERGE

    @Test
    void m1_emptyWeek_createsAllFour() {
        ApplyPlan plan = planner.plan(input(ApplyMode.MERGE, false, List.of(), List.of(), Set.of()));

        assertThat(templateEventIds(plan.toCreate())).containsExactly(t1Id, t2Id, t3Id, t4Id);
        PlannedEvent t4 = plan.toCreate().stream().filter(p -> p.templateEventId().equals(t4Id)).findFirst().orElseThrow();
        assertThat(t4.end()).isEqualTo(T4_END);
    }

    @Test
    void m2_afterM1_allSkippedAlreadyApplied() {
        ApplyPlan plan = planner.plan(input(ApplyMode.MERGE, false, afterM1(), afterM1(), Set.of()));

        assertThat(plan.toCreate()).isEmpty();
        assertThat(templateEventIds(plan.skippedAlreadyApplied())).containsExactlyInAnyOrder(t1Id, t2Id, t3Id, t4Id);
    }

    @Test
    void m3_e1MovedToNextWeek_stillFoundViaSameWeekSourced() {
        EventResponse e1Moved = sourced(e1Id, t1Id, LocalDateTime.of(2026, 11, 17, 10, 0),
                LocalDateTime.of(2026, 11, 17, 14, 0), Set.of(userA));
        List<EventResponse> sameWeekSourced = List.of(e1Moved, e2(), e3(), e4());

        ApplyPlan plan = planner.plan(input(ApplyMode.MERGE, false, List.of(e2(), e3(), e4()), sameWeekSourced, Set.of()));

        assertThat(plan.toCreate()).isEmpty();
        assertThat(templateEventIds(plan.skippedAlreadyApplied())).contains(t1Id);
    }

    @Test
    void m4_e3DeletedByUser_isSkippedDeletedNotRestored() {
        List<EventResponse> remaining = List.of(e1(), e2(), e4());

        ApplyPlan plan = planner.plan(input(ApplyMode.MERGE, false, remaining, remaining, Set.of(t3Id)));

        assertThat(plan.toCreate()).isEmpty();
        assertThat(templateEventIds(plan.skippedDeleted())).containsExactly(t3Id);
        assertThat(templateEventIds(plan.skippedAlreadyApplied())).containsExactlyInAnyOrder(t1Id, t2Id, t4Id);
    }

    @Test
    void m5_manualDoctorSharesParticipantWithT1_conflict() {
        EventResponse doctor = manual(LocalDateTime.of(2026, 11, 9, 10, 0), LocalDateTime.of(2026, 11, 9, 11, 0), Set.of(userA));

        ApplyPlan plan = planner.plan(input(ApplyMode.MERGE, false, List.of(doctor), List.of(), Set.of()));

        assertThat(plan.toCreate()).hasSize(4);
        assertThat(plan.conflicts()).hasSize(1);
        assertThat(plan.conflicts().get(0).planned().templateEventId()).isEqualTo(t1Id);
    }

    @Test
    void m6_manualDoctorForBOnly_noConflictWithT1() {
        EventResponse doctor = manual(LocalDateTime.of(2026, 11, 9, 10, 0), LocalDateTime.of(2026, 11, 9, 11, 0), Set.of(userB));

        ApplyPlan plan = planner.plan(input(ApplyMode.MERGE, false, List.of(doctor), List.of(), Set.of()));

        assertThat(plan.toCreate()).hasSize(4);
        assertThat(plan.conflicts()).isEmpty();
    }

    @Test
    void m7_eventFromAnotherTemplateOverlapsT1_conflict() {
        EventResponse sport = manual(LocalDateTime.of(2026, 11, 9, 12, 30), LocalDateTime.of(2026, 11, 9, 13, 30), Set.of(userA));

        ApplyPlan plan = planner.plan(input(ApplyMode.MERGE, false, List.of(sport), List.of(), Set.of()));

        assertThat(plan.toCreate()).hasSize(4);
        assertThat(plan.conflicts()).hasSize(1);
        assertThat(plan.conflicts().get(0).planned().templateEventId()).isEqualTo(t1Id);
    }

    @Test
    void m8_manualEventNextMondayOverlapsT4Tail_windowIsFourteenDays() {
        EventResponse nextMonday = manual(LocalDateTime.of(2026, 11, 16, 6, 0), LocalDateTime.of(2026, 11, 16, 8, 0), Set.of(userA));

        ApplyPlan plan = planner.plan(input(ApplyMode.MERGE, false, List.of(nextMonday), List.of(), Set.of()));

        assertThat(plan.toCreate()).hasSize(4);
        assertThat(plan.conflicts()).hasSize(1);
        assertThat(plan.conflicts().get(0).planned().templateEventId()).isEqualTo(t4Id);
    }

    // ----------------------------------------------------------------- FILL

    @Test
    void f1_tripOnFriday_skipsT3Only() {
        EventResponse trip = manual(LocalDateTime.of(2026, 11, 13, 8, 0), LocalDateTime.of(2026, 11, 13, 20, 0), Set.of(userA, userB));

        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, List.of(trip), List.of(), Set.of()));

        assertThat(templateEventIds(plan.toCreate())).containsExactly(t1Id, t2Id, t4Id);
        assertThat(templateEventIds(plan.skippedBusy())).containsExactly(t3Id);
    }

    @Test
    void f2_morningDoctorForB_doesNotMakeDayBusy() {
        EventResponse doctor = manual(LocalDateTime.of(2026, 11, 9, 10, 0), LocalDateTime.of(2026, 11, 9, 11, 0), Set.of(userB));

        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, List.of(doctor), List.of(), Set.of()));

        assertThat(plan.toCreate()).hasSize(4);
        assertThat(plan.skippedBusy()).isEmpty();
    }

    @Test
    void f3_afternoonMeetingForB_makesMondayBusyForB_skipsSharedT2() {
        EventResponse meeting = manual(LocalDateTime.of(2026, 11, 9, 14, 0), LocalDateTime.of(2026, 11, 9, 15, 0), Set.of(userB));

        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, List.of(meeting), List.of(), Set.of()));

        assertThat(templateEventIds(plan.toCreate())).containsExactly(t1Id, t3Id, t4Id);
        assertThat(templateEventIds(plan.skippedBusy())).containsExactly(t2Id);
    }

    @Test
    void f4_nightSleepEndingBeforeNoon_leavesMondayFree() {
        EventResponse sleep = manual(LocalDateTime.of(2026, 11, 8, 23, 0), LocalDateTime.of(2026, 11, 9, 7, 0), Set.of(userA));

        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, List.of(sleep), List.of(), Set.of()));

        assertThat(plan.toCreate()).hasSize(4);
    }

    @Test
    void f5_longWeekendTrip_skipsFridaySaturdaySunday() {
        EventResponse trip = manual(LocalDateTime.of(2026, 11, 13, 8, 0), LocalDateTime.of(2026, 11, 15, 20, 0), Set.of(userA, userB));

        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, List.of(trip), List.of(), Set.of()));

        assertThat(templateEventIds(plan.skippedBusy())).containsExactlyInAnyOrder(t3Id, t4Id);
        assertThat(templateEventIds(plan.toCreate())).containsExactly(t1Id, t2Id);
    }

    @Test
    void f6_eventEndingExactlyAtNoon_doesNotSkipButStillConflicts() {
        EventResponse morning = manual(LocalDateTime.of(2026, 11, 9, 8, 0), LocalDateTime.of(2026, 11, 9, 12, 0), Set.of(userA));

        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, List.of(morning), List.of(), Set.of()));

        assertThat(plan.toCreate()).hasSize(4);
        assertThat(plan.conflicts()).hasSize(1);
        assertThat(plan.conflicts().get(0).planned().templateEventId()).isEqualTo(t1Id);
    }

    @Test
    void f7_eventEndingOneMinuteAfterNoon_skipsSharedMondayEntries() {
        EventResponse morning = manual(LocalDateTime.of(2026, 11, 9, 8, 0), LocalDateTime.of(2026, 11, 9, 12, 1), Set.of(userA));

        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, List.of(morning), List.of(), Set.of()));

        assertThat(templateEventIds(plan.skippedBusy())).containsExactlyInAnyOrder(t1Id, t2Id);
        assertThat(templateEventIds(plan.toCreate())).containsExactly(t3Id, t4Id);
    }

    @Test
    void f8_afterM1_duplicateCheckWinsOverBusyCheck() {
        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, afterM1(), afterM1(), Set.of()));

        assertThat(plan.toCreate()).isEmpty();
        assertThat(plan.skippedAlreadyApplied()).hasSize(4);
        assertThat(plan.skippedBusy()).isEmpty();
    }

    @Test
    void f9_emptyWeek_ownPlanEntriesDoNotMakeDayBusyForEachOther() {
        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, List.of(), List.of(), Set.of()));

        assertThat(plan.toCreate()).hasSize(4);
    }

    @Test
    void f10_e3DeletedByUser_fillDoesNotRestoreIt() {
        List<EventResponse> remaining = List.of(e1(), e2(), e4());

        ApplyPlan plan = planner.plan(input(ApplyMode.FILL, false, remaining, remaining, Set.of(t3Id)));

        assertThat(templateEventIds(plan.skippedDeleted())).containsExactly(t3Id);
        assertThat(plan.restoredDeleted()).isEmpty();
    }

    // -------------------------------------------------------------- REPLACE

    @Test
    void r1_afterM1PlusManualDoctor_includeManualFalse_doctorStaysAndConflicts() {
        EventResponse doctor = manual(LocalDateTime.of(2026, 11, 9, 10, 0), LocalDateTime.of(2026, 11, 9, 11, 0), Set.of(userA));
        List<EventResponse> windowEvents = concat(afterM1(), doctor);

        ApplyPlan plan = planner.plan(input(ApplyMode.REPLACE, false, windowEvents, afterM1(), Set.of()));

        assertThat(eventIds(plan.toDelete())).containsExactlyInAnyOrder(e1Id, e2Id, e3Id, e4Id);
        assertThat(plan.toCreate()).hasSize(4);
        assertThat(plan.conflicts()).hasSize(1);
        assertThat(plan.conflicts().get(0).planned().templateEventId()).isEqualTo(t1Id);
        assertThat(plan.conflicts().get(0).existing().id()).isEqualTo(doctor.id());
    }

    @Test
    void r2_includeManualTrue_doctorAlsoDeletedAndNoConflictsRemain() {
        EventResponse doctor = manual(LocalDateTime.of(2026, 11, 9, 10, 0), LocalDateTime.of(2026, 11, 9, 11, 0), Set.of(userA));
        List<EventResponse> windowEvents = concat(afterM1(), doctor);

        ApplyPlan plan = planner.plan(input(ApplyMode.REPLACE, true, windowEvents, afterM1(), Set.of()));

        assertThat(eventIds(plan.toDelete())).containsExactlyInAnyOrder(e1Id, e2Id, e3Id, doctor.id(), e4Id);
        assertThat(plan.toCreate()).hasSize(4);
        assertThat(plan.conflicts()).isEmpty();
    }

    @Test
    void r3_e3DeletedByUser_isDeletedAgainNoAndRestoredWithConfirmation() {
        List<EventResponse> remaining = List.of(e1(), e2(), e4());

        ApplyPlan plan = planner.plan(input(ApplyMode.REPLACE, false, remaining, remaining, Set.of(t3Id)));

        assertThat(eventIds(plan.toDelete())).containsExactlyInAnyOrder(e1Id, e2Id, e4Id);
        assertThat(plan.toCreate()).hasSize(4);
        assertThat(templateEventIds(plan.restoredDeleted())).containsExactly(t3Id);
    }

    @Test
    void r4_e1MovedOutOfWeek_notDeletedButStillCountsAsAlreadyApplied() {
        EventResponse e1Moved = sourced(e1Id, t1Id, LocalDateTime.of(2026, 11, 17, 10, 0),
                LocalDateTime.of(2026, 11, 17, 14, 0), Set.of(userA));
        List<EventResponse> windowEvents = List.of(e1Moved, e2(), e3(), e4());
        List<EventResponse> sameWeekSourced = List.of(e1Moved, e2(), e3(), e4());

        ApplyPlan plan = planner.plan(input(ApplyMode.REPLACE, false, windowEvents, sameWeekSourced, Set.of()));

        assertThat(eventIds(plan.toDelete())).containsExactlyInAnyOrder(e2Id, e3Id, e4Id);
        assertThat(templateEventIds(plan.skippedAlreadyApplied())).containsExactly(t1Id);
        assertThat(templateEventIds(plan.toCreate())).containsExactly(t2Id, t3Id, t4Id);
    }

    @Test
    void r5_eventFromAnotherTemplateStartingInWeek_isAlsoDeleted() {
        UUID otherTemplateEventId = UUID.randomUUID();
        EventResponse training = sourced(UUID.randomUUID(), otherTemplateEventId,
                LocalDateTime.of(2026, 11, 11, 18, 0), LocalDateTime.of(2026, 11, 11, 19, 0), Set.of(userA));

        ApplyPlan plan = planner.plan(input(ApplyMode.REPLACE, false, List.of(training), List.of(), Set.of()));

        assertThat(eventIds(plan.toDelete())).contains(training.id());
    }

    @Test
    void r6_occurrenceStartingBeforeTheWeek_isNotDeleted() {
        EventResponse previousWeekTail = sourced(UUID.randomUUID(), t4Id,
                LocalDateTime.of(2026, 11, 8, 23, 0), LocalDateTime.of(2026, 11, 9, 7, 0), Set.of(userA));

        ApplyPlan plan = planner.plan(input(ApplyMode.REPLACE, false, List.of(previousWeekTail), List.of(), Set.of()));

        assertThat(eventIds(plan.toDelete())).doesNotContain(previousWeekTail.id());
    }

    @Test
    void r7_emptyWeek_nothingToDeleteButCreatesAllFour() {
        ApplyPlan plan = planner.plan(input(ApplyMode.REPLACE, false, List.of(), List.of(), Set.of()));

        assertThat(plan.toDelete()).isEmpty();
        assertThat(plan.toCreate()).hasSize(4);
    }

    @Test
    void r8_e1AndE3DeletedByUser_bothRestoredWithConfirmation() {
        List<EventResponse> remaining = List.of(e2(), e4());

        ApplyPlan plan = planner.plan(input(ApplyMode.REPLACE, false, remaining, remaining, Set.of(t1Id, t3Id)));

        assertThat(eventIds(plan.toDelete())).containsExactlyInAnyOrder(e2Id, e4Id);
        assertThat(plan.toCreate()).hasSize(4);
        assertThat(templateEventIds(plan.restoredDeleted())).containsExactlyInAnyOrder(t1Id, t3Id);
    }

    // ------------------------------------------------------------- фикстура

    private List<TemplateEventResponse> templateEvents() {
        return List.of(
                templateEvent(t1Id, DayOfWeek.MONDAY, LocalTime.of(9, 0), 240, Set.of(userA)),
                templateEvent(t2Id, DayOfWeek.MONDAY, LocalTime.of(23, 0), 480, Set.of(userA, userB)),
                templateEvent(t3Id, DayOfWeek.FRIDAY, LocalTime.of(19, 0), 120, Set.of(userA, userB)),
                templateEvent(t4Id, DayOfWeek.SUNDAY, LocalTime.of(23, 0), 480, Set.of(userA)));
    }

    private TemplateEventResponse templateEvent(UUID id, DayOfWeek dow, LocalTime time, int minutes, Set<UUID> participants) {
        return new TemplateEventResponse(id, "T-event", null, dow, time, minutes, participants, EventCategory.WORK, null);
    }

    private EventResponse e1() {
        return sourced(e1Id, t1Id, T1_START, T1_END, Set.of(userA));
    }

    private EventResponse e2() {
        return sourced(e2Id, t2Id, T2_START, T2_END, Set.of(userA, userB));
    }

    private EventResponse e3() {
        return sourced(e3Id, t3Id, T3_START, T3_END, Set.of(userA, userB));
    }

    private EventResponse e4() {
        return sourced(e4Id, t4Id, T4_START, T4_END, Set.of(userA));
    }

    private List<EventResponse> afterM1() {
        return List.of(e1(), e2(), e3(), e4());
    }

    private EventResponse sourced(UUID id, UUID templateEventId, LocalDateTime start, LocalDateTime end, Set<UUID> participants) {
        return event(id, start, end, participants, new EventSourceResponse(templateEventId, WEEK_START, "Обычная неделя"));
    }

    private EventResponse manual(LocalDateTime start, LocalDateTime end, Set<UUID> participants) {
        return event(UUID.randomUUID(), start, end, participants, null);
    }

    private EventResponse event(UUID id, LocalDateTime start, LocalDateTime end, Set<UUID> participants, EventSourceResponse source) {
        return new EventResponse(id, "Event", null, start, end, participants, EventCategory.WORK, null,
                source, userA, userA, Instant.EPOCH, Instant.EPOCH, 0);
    }

    private List<EventResponse> concat(List<EventResponse> base, EventResponse extra) {
        List<EventResponse> result = new java.util.ArrayList<>(base);
        result.add(extra);
        return result;
    }

    private PlanInput input(ApplyMode mode, boolean includeManual, List<EventResponse> windowEvents,
                             List<EventResponse> sameWeekSourced, Set<UUID> excludedIds) {
        return new PlanInput(WEEK_START, ZONE, mode, includeManual, templateEvents(), windowEvents, sameWeekSourced, excludedIds);
    }

    private List<UUID> templateEventIds(List<PlannedEvent> events) {
        return events.stream().map(PlannedEvent::templateEventId).toList();
    }

    private List<UUID> eventIds(List<EventResponse> events) {
        return events.stream().map(EventResponse::id).toList();
    }
}
