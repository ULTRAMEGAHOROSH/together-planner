package com.togetherplanner.template.dto;

import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.template.entity.ApplyMode;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Input to {@code ApplyPlanner} - a pure class with no Spring, no
 * repositories, no {@code Clock}. All the data is loaded upfront by
 * {@code TemplateApplyService}.
 */
public record PlanInput(
        LocalDate weekStart,
        ZoneId zone,
        ApplyMode mode,
        boolean includeManual,
        List<TemplateEventResponse> templateEvents,
        List<EventResponse> windowEvents,
        List<EventResponse> sameWeekSourced,
        Set<UUID> excludedTemplateEventIds) {
}
