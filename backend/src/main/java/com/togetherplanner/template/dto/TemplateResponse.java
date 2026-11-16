package com.togetherplanner.template.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record TemplateResponse(
        UUID id, String name, String description,
        List<TemplateEventResponse> events,
        TemplateApplicationResponse lastApplication,
        Instant createdAt, Instant updatedAt, long version) {
}
