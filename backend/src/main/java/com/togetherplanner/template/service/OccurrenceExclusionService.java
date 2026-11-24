package com.togetherplanner.template.service;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;

/** {@code on} is a plain synchronous {@code @EventListener}, not a {@code @TransactionalEventListener} - the exclusion has to land in the same transaction as the event deletion that triggered it. */
public interface OccurrenceExclusionService {

    /** Called when building the plan input, both for preview and apply. */
    Set<UUID> excludedFor(LocalDate weekStart, Collection<UUID> templateEventIds);

    /** Called by REPLACE to clear exclusions for the occurrences it restores. */
    void clear(LocalDate weekStart, Collection<UUID> templateEventIds);
}
