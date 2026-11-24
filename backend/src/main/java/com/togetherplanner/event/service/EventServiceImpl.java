package com.togetherplanner.event.service;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.common.error.VersionGuard;
import com.togetherplanner.common.time.TimeService;
import com.togetherplanner.common.web.PageResponse;
import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.dto.NewTemplateEvent;
import com.togetherplanner.event.dto.TemplateOccurrenceDeletedEvent;
import com.togetherplanner.event.entity.Event;
import com.togetherplanner.event.entity.EventSource;
import com.togetherplanner.event.mapper.EventMapper;
import com.togetherplanner.event.repository.EventRepository;
import com.togetherplanner.workspace.service.WorkspaceAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Event CRUD, plus the cross-module methods used by the template apply flow. */
@Service
@RequiredArgsConstructor
public class EventServiceImpl implements EventService {

    private static final int MAX_RANGE_DAYS = 93;

    private final EventRepository eventRepository;
    private final EventMapper eventMapper;
    private final EventValidator eventValidator;
    private final WorkspaceAccessService workspaceAccessService;
    private final ApplicationEventPublisher eventPublisher;
    private final TimeService timeService;
    private final Clock clock;

    @Override
    @Transactional
    public EventResponse create(UUID wsId, UUID userId, EventRequest request) {
        workspaceAccessService.requireMember(wsId, userId);
        ZoneId zone = workspaceAccessService.zoneOf(wsId);
        Set<UUID> memberIds = workspaceAccessService.memberIds(wsId);

        String title = eventValidator.requireNonBlankTitle(request.title());
        ValidatedEventTimes times = eventValidator.normalizeAndValidateTimes(request.start(), request.end(), zone);
        eventValidator.requireParticipantsAreMembers(request.participantIds(), memberIds);

        Event event = new Event(wsId, title, request.description(), times.start(), times.end(),
                request.category(), request.color(), null, request.participantIds(), userId, clock.instant());
        return eventMapper.toResponse(eventRepository.save(event));
    }

    @Override
    @Transactional(readOnly = true)
    public EventResponse get(UUID wsId, UUID userId, UUID eventId) {
        workspaceAccessService.requireMember(wsId, userId);
        return eventMapper.toResponse(findOwned(wsId, eventId));
    }

    @Override
    @Transactional
    public EventResponse update(UUID wsId, UUID userId, UUID eventId, EventRequest request) {
        workspaceAccessService.requireMember(wsId, userId);
        Event event = findOwned(wsId, eventId);
        VersionGuard.requireVersion(request.version(), event.getVersion());

        ZoneId zone = workspaceAccessService.zoneOf(wsId);
        Set<UUID> memberIds = workspaceAccessService.memberIds(wsId);

        String title = eventValidator.requireNonBlankTitle(request.title());
        ValidatedEventTimes times = eventValidator.normalizeAndValidateTimes(request.start(), request.end(), zone);
        eventValidator.requireParticipantsAreMembers(request.participantIds(), memberIds);

        event.setTitle(title);
        event.setDescription(request.description());
        event.setStartLocal(times.start());
        event.setEndLocal(times.end());
        event.setCategory(request.category());
        event.setColor(request.color());
        event.setParticipantIds(new HashSet<>(request.participantIds()));
        event.setUpdatedBy(userId);
        event.setUpdatedAt(clock.instant());

        // flush() here - otherwise the UPDATE only runs at commit time, after
        // this method has already returned, and the client would get back a
        // stale version (Hibernate bumps @Version during the UPDATE itself).
        eventRepository.flush();
        return eventMapper.toResponse(event);
    }

    @Override
    @Transactional
    public void deleteByUser(UUID wsId, UUID userId, UUID eventId, Long expectedVersion) {
        workspaceAccessService.requireMember(wsId, userId);
        Event event = findOwned(wsId, eventId);
        VersionGuard.requireVersion(expectedVersion, event.getVersion());

        EventSource source = event.getSource();
        eventRepository.delete(event);

        if (source != null) {
            eventPublisher.publishEvent(new TemplateOccurrenceDeletedEvent(
                    wsId, source.getTemplateEventId(), source.getWeekStart(), userId));
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<EventResponse> listRange(UUID wsId, UUID userId, LocalDate from, LocalDate to) {
        workspaceAccessService.requireMember(wsId, userId);
        long inclusiveDays = ChronoUnit.DAYS.between(from, to) + 1;
        if (to.isBefore(from) || inclusiveDays > MAX_RANGE_DAYS) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE,
                    "Range must cover between 1 and " + MAX_RANGE_DAYS + " days");
        }
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.plusDays(1).atStartOfDay();
        return eventRepository.findOverlapping(wsId, fromDateTime, toDateTime).stream()
                .map(eventMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<EventResponse> upcoming(UUID wsId, UUID userId, Pageable pageable) {
        workspaceAccessService.requireMember(wsId, userId);
        ZoneId zone = workspaceAccessService.zoneOf(wsId);
        LocalDateTime now = timeService.now(zone);
        Page<Event> page = eventRepository.findUpcoming(wsId, now, pageable);
        return PageResponse.of(page, eventMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EventResponse> findOverlapping(UUID wsId, LocalDateTime from, LocalDateTime to) {
        return eventRepository.findOverlapping(wsId, from, to).stream()
                .map(eventMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<EventResponse> findBySourceWeek(UUID wsId, LocalDate weekStart, Collection<UUID> templateEventIds) {
        if (templateEventIds.isEmpty()) {
            return List.of();
        }
        return eventRepository.findBySourceWeek(wsId, weekStart, templateEventIds).stream()
                .map(eventMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public List<EventResponse> createFromTemplate(UUID wsId, UUID userId, List<NewTemplateEvent> newEvents) {
        if (newEvents.isEmpty()) {
            return List.of();
        }
        ZoneId zone = workspaceAccessService.zoneOf(wsId);
        Set<UUID> memberIds = workspaceAccessService.memberIds(wsId);
        Instant now = clock.instant();

        List<Event> events = new ArrayList<>();
        for (NewTemplateEvent request : newEvents) {
            String title = eventValidator.requireNonBlankTitle(request.title());
            ValidatedEventTimes times = eventValidator.normalizeAndValidateTimes(request.start(), request.end(), zone);
            eventValidator.requireParticipantsAreMembers(request.participantIds(), memberIds);

            EventSource source = new EventSource(request.templateEventId(), request.weekStart(), request.templateName());
            events.add(new Event(wsId, title, request.description(), times.start(), times.end(),
                    request.category(), request.color(), source, request.participantIds(), userId, now));
        }
        return eventRepository.saveAll(events).stream().map(eventMapper::toResponse).toList();
    }

    @Override
    @Transactional
    public void deleteForTemplateReplace(UUID wsId, Collection<UUID> eventIds) {
        if (eventIds.isEmpty()) {
            return;
        }
        List<Event> events = eventRepository.findAllById(eventIds);
        eventRepository.deleteAll(events);
        eventRepository.flush();
    }

    private Event findOwned(UUID wsId, UUID eventId) {
        return eventRepository.findByIdAndWorkspaceId(eventId, wsId)
                .orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND, "Event not found"));
    }
}
