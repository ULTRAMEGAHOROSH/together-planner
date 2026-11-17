package com.togetherplanner.event.dto;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

/** Command for creating an event from a template occurrence - input to {@code EventService.createFromTemplate}. */
public record NewTemplateEvent(String title, String description, LocalDateTime start, LocalDateTime end,
                                Set<UUID> participantIds, EventCategory category, EventColor color,
                                UUID templateEventId, LocalDate weekStart, String templateName) {
}
