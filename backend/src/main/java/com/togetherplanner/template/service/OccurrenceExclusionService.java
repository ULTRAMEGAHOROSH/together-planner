package com.togetherplanner.template.service;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;

public interface OccurrenceExclusionService {

    Set<UUID> excludedFor(LocalDate weekStart, Collection<UUID> templateEventIds);

    void clear(LocalDate weekStart, Collection<UUID> templateEventIds);
}
