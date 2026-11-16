package com.togetherplanner.event.dto;

import java.time.LocalDate;
import java.util.UUID;

/**
 * spec §6.3. Публикуется {@code EventService.deleteByUser} через
 * {@code ApplicationEventPublisher}, только если у удаляемого события есть
 * {@code source}. Слушатель ({@code OccurrenceExclusionService}) появится в
 * этапе 7.2 — публикация без слушателя безопасна.
 */
public record TemplateOccurrenceDeletedEvent(UUID workspaceId, UUID templateEventId, LocalDate weekStart, UUID deletedBy) {
}
