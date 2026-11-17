package com.togetherplanner.event.dto;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

/** Shared by POST and PUT - {@code version} is required only on PUT, enforced by the service. */
public record EventRequest(
        @NotBlank @Size(max = 100) String title,
        @Size(max = 2000) String description,
        @NotNull LocalDateTime start,
        @NotNull LocalDateTime end,
        @NotEmpty @Size(max = 2) Set<@NotNull UUID> participantIds,
        @NotNull EventCategory category,
        EventColor color,
        Long version) {
}
