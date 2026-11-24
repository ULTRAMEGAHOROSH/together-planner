package com.togetherplanner.template.service;

import com.togetherplanner.event.dto.TemplateOccurrenceDeletedEvent;
import com.togetherplanner.template.entity.OccurrenceExclusion;
import com.togetherplanner.template.entity.OccurrenceExclusionId;
import com.togetherplanner.template.repository.OccurrenceExclusionRepository;
import com.togetherplanner.template.repository.TemplateEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * {@code on} is a plain synchronous {@code @EventListener}, not a
 * {@code @TransactionalEventListener} - the exclusion has to land in the
 * same transaction as the event deletion that triggered it.
 */
@Service
@RequiredArgsConstructor
public class OccurrenceExclusionServiceImpl implements OccurrenceExclusionService {

    private final OccurrenceExclusionRepository occurrenceExclusionRepository;
    private final TemplateEventRepository templateEventRepository;
    private final Clock clock;

    @EventListener
    public void on(TemplateOccurrenceDeletedEvent event) {
        if (!templateEventRepository.existsById(event.templateEventId())) {
            return;
        }
        OccurrenceExclusionId id = new OccurrenceExclusionId(event.templateEventId(), event.weekStart());
        if (occurrenceExclusionRepository.existsById(id)) {
            return;
        }
        occurrenceExclusionRepository.save(new OccurrenceExclusion(id, event.deletedBy(), clock.instant()));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> excludedFor(LocalDate weekStart, Collection<UUID> templateEventIds) {
        if (templateEventIds.isEmpty()) {
            return Set.of();
        }
        return occurrenceExclusionRepository.findForWeek(weekStart, templateEventIds).stream()
                .map(exclusion -> exclusion.getId().getTemplateEventId())
                .collect(Collectors.toSet());
    }

    @Override
    @Transactional
    public void clear(LocalDate weekStart, Collection<UUID> templateEventIds) {
        if (templateEventIds.isEmpty()) {
            return;
        }
        occurrenceExclusionRepository.deleteForWeek(weekStart, templateEventIds);
    }
}
