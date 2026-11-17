package com.togetherplanner.template.dto;

import com.togetherplanner.event.dto.EventResponse;

/** The occurrence will be created but overlaps an existing event for a shared participant - a warning, not an error. */
public record ApplyConflict(PlannedEvent planned, EventResponse existing) {
}
