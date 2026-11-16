package com.togetherplanner.template.repository;

import com.togetherplanner.template.entity.TemplateEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** {@code existsById} для {@code OccurrenceExclusionService} — этап 7.2. */
public interface TemplateEventRepository extends JpaRepository<TemplateEvent, UUID> {
}
