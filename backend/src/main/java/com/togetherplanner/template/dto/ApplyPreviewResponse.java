package com.togetherplanner.template.dto;

import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.template.entity.ApplyMode;

import java.time.LocalDate;
import java.util.List;

public record ApplyPreviewResponse(
        LocalDate weekStart,
        ApplyMode mode,
        List<PlannedEvent> toCreate,
        List<PlannedEvent> skippedAlreadyApplied,
        List<PlannedEvent> skippedDeleted,
        List<PlannedEvent> skippedBusy,
        List<PlannedEvent> restoredDeleted,
        List<ApplyConflict> conflicts,
        List<EventResponse> toDelete,
        int manualEventsInWeek) {
}
