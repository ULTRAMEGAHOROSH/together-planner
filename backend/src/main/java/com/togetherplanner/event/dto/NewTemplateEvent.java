package com.togetherplanner.event.dto;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

/** spec §6.4. Команда создания события из шаблона — вход {@code EventService.createFromTemplate} (этап 7). */
public record NewTemplateEvent(String title, String description, LocalDateTime start, LocalDateTime end,
                                Set<UUID> participantIds, EventCategory category, EventColor color,
                                UUID templateEventId, LocalDate weekStart, String templateName) {
}
