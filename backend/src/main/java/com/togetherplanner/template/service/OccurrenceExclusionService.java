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
 * spec §6.3, §9.2. Этап 7.2. {@code on} — обычный синхронный
 * {@code @EventListener} (не {@code @TransactionalEventListener}): исключение
 * должно появиться в той же транзакции, что и удаление события.
 */
@Service
@RequiredArgsConstructor
public class OccurrenceExclusionService {

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

    /** Публичный метод — spec §9.4 ({@code loadPlanInput}), §9.5 шаг 4. */
    @Transactional(readOnly = true)
    public Set<UUID> excludedFor(LocalDate weekStart, Collection<UUID> templateEventIds) {
        if (templateEventIds.isEmpty()) {
            return Set.of();
        }
        return occurrenceExclusionRepository.findForWeek(weekStart, templateEventIds).stream()
                .map(exclusion -> exclusion.getId().getTemplateEventId())
                .collect(Collectors.toSet());
    }

    /** Публичный метод — spec §9.5 шаг 8 (REPLACE снимает исключения восстановленных вхождений). */
    @Transactional
    public void clear(LocalDate weekStart, Collection<UUID> templateEventIds) {
        if (templateEventIds.isEmpty()) {
            return;
        }
        occurrenceExclusionRepository.deleteForWeek(weekStart, templateEventIds);
    }
}
