package com.togetherplanner.template.dto;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

public record TemplateEventResponse(
        UUID id, String title, String description,
        DayOfWeek dayOfWeek, LocalTime startTime, int durationMinutes,
        Set<UUID> participantIds, EventCategory category, EventColor color) {
}
