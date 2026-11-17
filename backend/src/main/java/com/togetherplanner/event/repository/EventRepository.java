package com.togetherplanner.event.repository;

import com.togetherplanner.event.entity.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID> {

    Optional<Event> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    /**
     * Overlap with the half-open interval {@code [from, to)}.
     * {@code searchFrom} is a lower bound on the {@code start_local}
     * index: no event is longer than 31 days, so anything starting before
     * {@code from - 31 days} can't possibly end after {@code from} - that
     * range gets cut by the index instead of relying only on the
     * {@code end_local > from} filter.
     */
    default List<Event> findOverlapping(UUID workspaceId, LocalDateTime from, LocalDateTime to) {
        return findOverlapping(workspaceId, from, to, from.minusDays(31));
    }

    @Query("select e from Event e where e.workspaceId = :workspaceId "
            + "and e.startLocal >= :searchFrom and e.startLocal < :to and e.endLocal > :from "
            + "order by e.startLocal asc, e.id asc")
    List<Event> findOverlapping(@Param("workspaceId") UUID workspaceId, @Param("from") LocalDateTime from,
                                 @Param("to") LocalDateTime to, @Param("searchFrom") LocalDateTime searchFrom);

    @Query("select e from Event e where e.workspaceId = :workspaceId and e.endLocal > :now "
            + "order by e.startLocal asc, e.id asc")
    Page<Event> findUpcoming(@Param("workspaceId") UUID workspaceId, @Param("now") LocalDateTime now, Pageable pageable);

    @Query("select e from Event e where e.workspaceId = :workspaceId and e.source.weekStart = :weekStart "
            + "and e.source.templateEventId in :templateEventIds")
    List<Event> findBySourceWeek(@Param("workspaceId") UUID workspaceId, @Param("weekStart") LocalDate weekStart,
                                  @Param("templateEventIds") Collection<UUID> templateEventIds);
}
