package com.togetherplanner.template.dto;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

/** {@code id == null} — новое событие шаблона; {@code id} есть — diff по id обновит эту строку (spec §9.8). */
public record TemplateEventRequest(
        UUID id,
        @NotBlank @Size(max = 100) String title,
        @Size(max = 2000) String description,
        @NotNull DayOfWeek dayOfWeek,
        @NotNull LocalTime startTime,
        @Min(1) @Max(10080) int durationMinutes,
        @NotEmpty @Size(max = 2) Set<@NotNull UUID> participantIds,
        @NotNull EventCategory category,
        EventColor color) {
}
