package com.togetherplanner.template.dto;

import com.togetherplanner.event.dto.EventResponse;

import java.util.List;

/**
 * Result of {@code ApplyPlanner.plan(PlanInput)}. Deliberately leaves out
 * {@code weekStart}/{@code mode} - those are inputs, not planning output.
 * {@code TemplateApplyService} echoes them back into the HTTP response.
 */
public record ApplyPlan(
        List<PlannedEvent> toCreate,
        List<PlannedEvent> skippedAlreadyApplied,
        List<PlannedEvent> skippedDeleted,
        List<PlannedEvent> skippedBusy,
        List<PlannedEvent> restoredDeleted,
        List<ApplyConflict> conflicts,
        List<EventResponse> toDelete,
        int manualEventsInWeek) {
}
