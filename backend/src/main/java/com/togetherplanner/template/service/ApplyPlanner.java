package com.togetherplanner.template.service;

import com.togetherplanner.common.time.TimeRules;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.template.dto.ApplyConflict;
import com.togetherplanner.template.dto.ApplyPlan;
import com.togetherplanner.template.dto.PlanInput;
import com.togetherplanner.template.dto.PlannedEvent;
import com.togetherplanner.template.dto.TemplateEventResponse;
import com.togetherplanner.template.entity.ApplyMode;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Pure class: no Spring, no repositories, no {@code Clock} - everything
 * it needs arrives through {@link PlanInput}. Used identically by
 * preview and apply, so their business rules can never drift apart.
 */
public final class ApplyPlanner {

    public ApplyPlan plan(PlanInput input) {
        LocalDateTime weekFrom = input.weekStart().atStartOfDay();
        LocalDateTime weekTo = weekFrom.plusDays(7);

        List<PlannedEvent> planned = materializeAll(input.templateEvents(), input.weekStart(), input.zone());

        // 1. deletions (REPLACE only)
        List<EventResponse> toDelete = input.mode() == ApplyMode.REPLACE
                ? input.windowEvents().stream()
                        .filter(e -> startsInWeek(e.start(), weekFrom, weekTo)
                                && (e.source() != null || input.includeManual()))
                        .toList()
                : List.of();
        Set<UUID> deletedIds = toDelete.stream().map(EventResponse::id).collect(Collectors.toSet());
        // "Before applying" state: for FILL, deletedIds is always empty (REPLACE
        // doesn't use skippedBusy), so remaining is literally windowEvents here.
        List<EventResponse> remaining = input.windowEvents().stream()
                .filter(e -> !deletedIds.contains(e.id()))
                .toList();

        // 2. which occurrences already exist (excluding what's about to be deleted)
        Set<UUID> existingKeys = input.sameWeekSourced().stream()
                .filter(e -> !deletedIds.contains(e.id()))
                .map(e -> e.source().templateEventId())
                .collect(Collectors.toSet());

        // 3. decide each occurrence - the check order below is deliberate
        List<PlannedEvent> toCreate = new ArrayList<>();
        List<PlannedEvent> skippedAlreadyApplied = new ArrayList<>();
        List<PlannedEvent> skippedDeleted = new ArrayList<>();
        List<PlannedEvent> skippedBusy = new ArrayList<>();
        List<PlannedEvent> restoredDeleted = new ArrayList<>();
        List<ApplyConflict> conflicts = new ArrayList<>();

        for (PlannedEvent p : planned) {
            boolean excluded = input.excludedTemplateEventIds().contains(p.templateEventId());

            if (input.mode() != ApplyMode.REPLACE && excluded) {
                skippedDeleted.add(p);
                continue;
            }
            if (existingKeys.contains(p.templateEventId())) {
                skippedAlreadyApplied.add(p);
                continue;
            }
            if (input.mode() == ApplyMode.FILL && isAnyParticipantBusy(p, remaining)) {
                skippedBusy.add(p);
                continue;
            }
            for (EventResponse e : remaining) {
                if (sharesParticipant(e, p) && TimeRules.overlaps(p.start(), p.end(), e.start(), e.end())) {
                    conflicts.add(new ApplyConflict(p, e));
                }
            }
            if (input.mode() == ApplyMode.REPLACE && excluded) {
                restoredDeleted.add(p);
            }
            toCreate.add(p);
        }

        int manualEventsInWeek = (int) input.windowEvents().stream()
                .filter(e -> startsInWeek(e.start(), weekFrom, weekTo) && e.source() == null)
                .count();

        return new ApplyPlan(toCreate, skippedAlreadyApplied, skippedDeleted, skippedBusy, restoredDeleted,
                conflicts, toDelete, manualEventsInWeek);
    }

    private List<PlannedEvent> materializeAll(List<TemplateEventResponse> templateEvents, LocalDate weekStart, ZoneId zone) {
        return templateEvents.stream()
                .map(te -> materialize(te, weekStart, zone))
                .sorted(Comparator.comparing(PlannedEvent::start).thenComparing(PlannedEvent::templateEventId))
                .toList();
    }

    /** Materializes a template event onto a specific week. */
    private PlannedEvent materialize(TemplateEventResponse te, LocalDate weekStart, ZoneId zone) {
        LocalDateTime naiveStart = weekStart.plusDays(te.dayOfWeek().getValue() - 1).atTime(te.startTime());
        LocalDateTime start = TimeRules.normalize(naiveStart, zone);
        LocalDateTime end = start.plusMinutes(te.durationMinutes());
        return new PlannedEvent(te.id(), te.title(), te.description(), start, end,
                te.participantIds(), te.category(), te.color());
    }

    private boolean startsInWeek(LocalDateTime start, LocalDateTime weekFrom, LocalDateTime weekTo) {
        return !start.isBefore(weekFrom) && start.isBefore(weekTo);
    }

    private boolean isAnyParticipantBusy(PlannedEvent p, List<EventResponse> remaining) {
        LocalDate day = p.start().toLocalDate();
        return p.participantIds().stream().anyMatch(userId -> remaining.stream()
                .anyMatch(e -> e.participantIds().contains(userId) && BusyDayRule.makesDayBusy(day, e.start(), e.end())));
    }

    private boolean sharesParticipant(EventResponse e, PlannedEvent p) {
        return !Collections.disjoint(e.participantIds(), p.participantIds());
    }
}
