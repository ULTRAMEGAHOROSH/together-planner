package com.togetherplanner.template.dto;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

/** Вхождение шаблона, переведённое на конкретную неделю (materialize, spec §9.1). */
public record PlannedEvent(UUID templateEventId, String title, String description,
                            LocalDateTime start, LocalDateTime end, Set<UUID> participantIds,
                            EventCategory category, EventColor color) {
}
