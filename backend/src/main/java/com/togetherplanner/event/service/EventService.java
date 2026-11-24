package com.togetherplanner.event.service;

import com.togetherplanner.common.web.PageResponse;
import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.dto.NewTemplateEvent;
import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Events of a workspace: manual CRUD, range and upcoming queries, and the hooks used by templates. */
public interface EventService {

    /** Manual creation: {@code source} is {@code null}, {@code createdBy} and {@code updatedBy} are the current user. */
    EventResponse create(UUID wsId, UUID userId, EventRequest request);

    /**
     * {@code @Transactional} is required here - without it,
     * {@code toResponse} hits a {@code LazyInitializationException} on
     * {@code participantIds}: the Hibernate session is already closed by
     * the time the lazy collection gets read outside a transaction.
     */
    EventResponse get(UUID wsId, UUID userId, UUID eventId);

    /** {@code source} is never touched on update - an event moved out of its template slot stays tagged as template-sourced. */
    EventResponse update(UUID wsId, UUID userId, UUID eventId, EventRequest request);

    /** Checks the version explicitly before deleting; if the event has a {@code source}, publishes an exclusion event. */
    void deleteByUser(UUID wsId, UUID userId, UUID eventId, Long expectedVersion);

    /** {@code from}/{@code to} are inclusive dates, so this overlaps {@code [from 00:00, to+1 00:00)}; range is capped at 93 days. */
    List<EventResponse> listRange(UUID wsId, UUID userId, LocalDate from, LocalDate to);

    /** {@code end > now} in the workspace's time zone - events in progress right now are included. */
    PageResponse<EventResponse> upcoming(UUID wsId, UUID userId, Pageable pageable);

    /** Called by the template and schedule modules. */
    List<EventResponse> findOverlapping(UUID wsId, LocalDateTime from, LocalDateTime to);

    /** Called by the template module. A dedicated lookup by provenance, not by time - a moved occurrence still has to be found. */
    List<EventResponse> findBySourceWeek(UUID wsId, LocalDate weekStart, Collection<UUID> templateEventIds);

    /**
     * Called by the template apply flow. Runs through the same
     * {@code EventValidator} as manual creation - cheap insurance against
     * a corrupted template, even though this data should already be valid.
     */
    List<EventResponse> createFromTemplate(UUID wsId, UUID userId, List<NewTemplateEvent> newEvents);

    /**
     * Called by the template apply flow during REPLACE. Deletes and
     * flushes immediately - without the flush, Hibernate would run every
     * INSERT before any DELETE and trip {@code uq_event_template_source}
     * whenever an occurrence is deleted and recreated in the same
     * transaction.
     */
    void deleteForTemplateReplace(UUID wsId, Collection<UUID> eventIds);
}
