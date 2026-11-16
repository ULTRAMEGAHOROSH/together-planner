package com.togetherplanner.event.service;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.common.error.VersionGuard;
import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.dto.TemplateOccurrenceDeletedEvent;
import com.togetherplanner.event.entity.Event;
import com.togetherplanner.event.entity.EventSource;
import com.togetherplanner.event.mapper.EventMapper;
import com.togetherplanner.event.repository.EventRepository;
import com.togetherplanner.workspace.service.WorkspaceAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/** E3–E6 (spec §8.6). {@code findOverlapping}, {@code createFromTemplate}, {@code deleteForTemplateReplace} — этап 7.1. */
@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final EventMapper eventMapper;
    private final EventValidator eventValidator;
    private final WorkspaceAccessService workspaceAccessService;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    /** E3: {@code source = null}, {@code createdBy = updatedBy = текущий}. */
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

    /**
     * E4. {@code @Transactional} — иначе {@code toResponse} ловит
     * {@code LazyInitializationException} на {@code participantIds}: сессия
     * Hibernate уже закрыта к моменту чтения ленивой коллекции без
     * открытой транзакции.
     */
    @Transactional(readOnly = true)
    public EventResponse get(UUID wsId, UUID userId, UUID eventId) {
        workspaceAccessService.requireMember(wsId, userId);
        return eventMapper.toResponse(findOwned(wsId, eventId));
    }

    /** E5: {@code source} не меняется — перенесённое из шаблона событие остаётся «из шаблона». */
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

        // flush() — иначе UPDATE выполняется только при коммите, ПОСЛЕ того,
        // как метод уже вернул ответ: клиент получил бы старое значение
        // version (@Version обновляется Hibernate во время самого UPDATE).
        eventRepository.flush();
        return eventMapper.toResponse(event);
    }

    /** E6: явная проверка {@code version} до удаления; если есть {@code source} — публикует исключение (spec §6.3). */
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

    private Event findOwned(UUID wsId, UUID eventId) {
        return eventRepository.findByIdAndWorkspaceId(eventId, wsId)
                .orElseThrow(() -> new ApiException(ErrorCode.EVENT_NOT_FOUND, "Event not found"));
    }
}
