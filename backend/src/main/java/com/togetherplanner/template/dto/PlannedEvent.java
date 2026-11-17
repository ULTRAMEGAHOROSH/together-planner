package com.togetherplanner.template.dto;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

/** A template occurrence materialized onto a specific week. */
public record PlannedEvent(UUID templateEventId, String title, String description,
                            LocalDateTime start, LocalDateTime end, Set<UUID> participantIds,
                            EventCategory category, EventColor color) {
}
