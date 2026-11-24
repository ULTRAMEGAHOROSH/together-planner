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

public interface EventService {

    EventResponse create(UUID wsId, UUID userId, EventRequest request);

    EventResponse get(UUID wsId, UUID userId, UUID eventId);

    EventResponse update(UUID wsId, UUID userId, UUID eventId, EventRequest request);

    void deleteByUser(UUID wsId, UUID userId, UUID eventId, Long expectedVersion);

    List<EventResponse> listRange(UUID wsId, UUID userId, LocalDate from, LocalDate to);

    PageResponse<EventResponse> upcoming(UUID wsId, UUID userId, Pageable pageable);

    List<EventResponse> findOverlapping(UUID wsId, LocalDateTime from, LocalDateTime to);

    List<EventResponse> findBySourceWeek(UUID wsId, LocalDate weekStart, Collection<UUID> templateEventIds);

    List<EventResponse> createFromTemplate(UUID wsId, UUID userId, List<NewTemplateEvent> newEvents);

    void deleteForTemplateReplace(UUID wsId, Collection<UUID> eventIds);
}
