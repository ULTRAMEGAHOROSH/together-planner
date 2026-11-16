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
 * spec §9.1–§9.4. Чистый класс: без Spring, без репозиториев, без
 * {@code Clock} — всё нужное приходит через {@link PlanInput}. Используется
 * одинаково предпросмотром (T6) и применением (T7, этап 7), поэтому их
 * бизнес-правила не могут разойтись.
 */
public final class ApplyPlanner {

    public ApplyPlan plan(PlanInput input) {
        LocalDateTime weekFrom = input.weekStart().atStartOfDay();
        LocalDateTime weekTo = weekFrom.plusDays(7);

        List<PlannedEvent> planned = materializeAll(input.templateEvents(), input.weekStart(), input.zone());

        // 1. удаления (только REPLACE)
        List<EventResponse> toDelete = input.mode() == ApplyMode.REPLACE
                ? input.windowEvents().stream()
                        .filter(e -> startsInWeek(e.start(), weekFrom, weekTo)
                                && (e.source() != null || input.includeManual()))
                        .toList()
                : List.of();
        Set<UUID> deletedIds = toDelete.stream().map(EventResponse::id).collect(Collectors.toSet());
        // «До применения»: для FILL deletedIds всегда пуст (REPLACE не использует skippedBusy),
        // так что remaining в этом случае буквально равен windowEvents.
        List<EventResponse> remaining = input.windowEvents().stream()
                .filter(e -> !deletedIds.contains(e.id()))
                .toList();

        // 2. какие вхождения уже существуют (за вычетом того, что будет удалено)
        Set<UUID> existingKeys = input.sameWeekSourced().stream()
                .filter(e -> !deletedIds.contains(e.id()))
                .map(e -> e.source().templateEventId())
                .collect(Collectors.toSet());

        // 3. решение по каждому вхождению — порядок проверок задан намеренно
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

    /** Вхождение — событие шаблона, переведённое на конкретную неделю (spec §9.1). */
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
