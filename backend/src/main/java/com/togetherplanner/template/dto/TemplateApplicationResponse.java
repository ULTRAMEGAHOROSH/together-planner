package com.togetherplanner.template.dto;

import com.togetherplanner.template.entity.ApplyMode;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record TemplateApplicationResponse(
        UUID id, UUID templateId, String templateName, LocalDate weekStart, ApplyMode mode,
        int createdCount, int skippedCount, int deletedCount, UUID appliedBy, Instant appliedAt) {
}
