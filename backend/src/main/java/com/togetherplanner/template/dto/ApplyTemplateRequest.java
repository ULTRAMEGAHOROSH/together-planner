package com.togetherplanner.template.dto;

import com.togetherplanner.template.entity.ApplyMode;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * spec §8.8. {@code confirmedDeleteIds}/{@code confirmedRestoredIds} —
 * обязательны (могут быть пустыми множествами) только для T7 + REPLACE;
 * в T6 и в MERGE/FILL оба поля игнорируются.
 */
public record ApplyTemplateRequest(
        @NotNull LocalDate weekStart,
        @NotNull ApplyMode mode,
        boolean includeManual,
        Set<UUID> confirmedDeleteIds,
        Set<UUID> confirmedRestoredIds) {
}
