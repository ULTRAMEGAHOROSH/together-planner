package com.togetherplanner.template.repository;

import com.togetherplanner.template.entity.OccurrenceExclusion;
import com.togetherplanner.template.entity.OccurrenceExclusionId;
import org.springframework.data.jpa.repository.JpaRepository;

/** Методы для планировщика (поиск/удаление исключений недели) — этап 7.2. */
public interface OccurrenceExclusionRepository extends JpaRepository<OccurrenceExclusion, OccurrenceExclusionId> {
}
