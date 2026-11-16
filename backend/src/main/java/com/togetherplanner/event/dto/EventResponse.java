package com.togetherplanner.event.dto;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

public record EventResponse(
        UUID id, String title, String description,
        LocalDateTime start, LocalDateTime end,
        Set<UUID> participantIds,
        EventCategory category, EventColor color,
        EventSourceResponse source,
        UUID createdBy, UUID updatedBy,
        Instant createdAt, Instant updatedAt,
        long version) {
}
