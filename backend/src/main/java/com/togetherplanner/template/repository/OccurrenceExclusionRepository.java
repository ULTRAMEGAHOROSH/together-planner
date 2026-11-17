package com.togetherplanner.template.repository;

import com.togetherplanner.template.entity.OccurrenceExclusion;
import com.togetherplanner.template.entity.OccurrenceExclusionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Lookup and cleanup of per-week exclusions, used by the apply flow. */
public interface OccurrenceExclusionRepository extends JpaRepository<OccurrenceExclusion, OccurrenceExclusionId> {

    @Query("""
            select e from OccurrenceExclusion e
            where e.id.weekStart = :weekStart and e.id.templateEventId in :templateEventIds
            """)
    List<OccurrenceExclusion> findForWeek(@Param("weekStart") LocalDate weekStart,
                                           @Param("templateEventIds") Collection<UUID> templateEventIds);

    @Modifying
    @Query("""
            delete from OccurrenceExclusion e
            where e.id.weekStart = :weekStart and e.id.templateEventId in :templateEventIds
            """)
    void deleteForWeek(@Param("weekStart") LocalDate weekStart,
                        @Param("templateEventIds") Collection<UUID> templateEventIds);
}
