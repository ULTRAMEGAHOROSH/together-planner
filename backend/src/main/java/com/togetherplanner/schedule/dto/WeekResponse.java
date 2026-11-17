package com.togetherplanner.schedule.dto;

import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.template.dto.TemplateApplicationResponse;
import com.togetherplanner.workspace.dto.MemberResponse;

import java.time.LocalDate;
import java.util.List;

/** spec §8.5 (S1). */
public record WeekResponse(
        LocalDate weekStart,
        LocalDate weekEnd,
        String timeZone,
        List<MemberResponse> members,
        List<EventResponse> events,
        List<TemplateApplicationResponse> appliedTemplates) {
}
