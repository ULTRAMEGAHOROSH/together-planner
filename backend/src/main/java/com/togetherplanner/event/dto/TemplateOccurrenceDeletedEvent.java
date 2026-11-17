package com.togetherplanner.event.dto;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published by {@code EventService.deleteByUser} through an
 * {@code ApplicationEventPublisher}, only when the deleted event has a
 * {@code source}. Picked up by {@code OccurrenceExclusionService}.
 */
public record TemplateOccurrenceDeletedEvent(UUID workspaceId, UUID templateEventId, LocalDate weekStart, UUID deletedBy) {
}
