package com.togetherplanner.event.dto;

import java.time.LocalDate;
import java.util.UUID;

public record EventSourceResponse(UUID templateEventId, LocalDate weekStart, String templateName) {
}
