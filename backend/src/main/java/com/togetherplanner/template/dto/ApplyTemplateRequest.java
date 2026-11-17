package com.togetherplanner.template.dto;

import com.togetherplanner.template.entity.ApplyMode;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * {@code confirmedDeleteIds}/{@code confirmedRestoredIds} are required
 * (may be empty sets) only when applying - not previewing - in REPLACE
 * mode. Ignored for preview and for MERGE/FILL.
 */
public record ApplyTemplateRequest(
        @NotNull LocalDate weekStart,
        @NotNull ApplyMode mode,
        boolean includeManual,
        Set<UUID> confirmedDeleteIds,
        Set<UUID> confirmedRestoredIds) {
}
