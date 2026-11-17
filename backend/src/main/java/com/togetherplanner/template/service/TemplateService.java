package com.togetherplanner.template.service;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.common.error.VersionGuard;
import com.togetherplanner.template.dto.TemplateEventRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.template.entity.TemplateApplication;
import com.togetherplanner.template.entity.TemplateEvent;
import com.togetherplanner.template.entity.WeekTemplate;
import com.togetherplanner.template.mapper.TemplateMapper;
import com.togetherplanner.template.repository.TemplateApplicationRepository;
import com.togetherplanner.template.repository.WeekTemplateRepository;
import com.togetherplanner.workspace.service.WorkspaceAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Template CRUD. */
@Service
@RequiredArgsConstructor
public class TemplateService {

    private final WeekTemplateRepository weekTemplateRepository;
    private final TemplateApplicationRepository templateApplicationRepository;
    private final TemplateMapper templateMapper;
    private final WorkspaceAccessService workspaceAccessService;
    private final Clock clock;

    /** Templates are returned in full, ordered by {@code name}. */
    @Transactional(readOnly = true)
    public List<TemplateResponse> list(UUID wsId, UUID userId) {
        workspaceAccessService.requireMember(wsId, userId);
        return weekTemplateRepository.findByWorkspaceIdOrderByName(wsId).stream()
                .map(this::toResponseWithLastApplication)
                .toList();
    }

    /** {@code name} is trimmed; a non-null {@code id} on a new event is rejected as a validation error. */
    @Transactional
    public TemplateResponse create(UUID wsId, UUID userId, TemplateRequest request) {
        workspaceAccessService.requireMember(wsId, userId);
        String name = request.name().trim();
        if (weekTemplateRepository.existsByWorkspaceIdAndNameIgnoreCase(wsId, name)) {
            throw new ApiException(ErrorCode.TEMPLATE_NAME_TAKEN, "Template name is already taken");
        }

        Set<UUID> memberIds = workspaceAccessService.memberIds(wsId);
        for (TemplateEventRequest eventRequest : request.events()) {
            if (eventRequest.id() != null) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "New template events must not have an id");
            }
            requireParticipantsAreMembers(eventRequest.participantIds(), memberIds);
        }

        WeekTemplate template = new WeekTemplate(wsId, name, request.description(), userId, clock.instant());
        for (TemplateEventRequest eventRequest : request.events()) {
            template.getEvents().add(newTemplateEvent(template, eventRequest));
        }

        WeekTemplate saved = weekTemplateRepository.save(template);
        return templateMapper.toResponse(saved, null);
    }

    @Transactional(readOnly = true)
    public TemplateResponse get(UUID wsId, UUID userId, UUID templateId) {
        workspaceAccessService.requireMember(wsId, userId);
        return toResponseWithLastApplication(findOwned(wsId, templateId));
    }

    /** Updates by diffing events by id. Doesn't touch any Event rows - events already created from this template are left as they are. */
    @Transactional
    public TemplateResponse update(UUID wsId, UUID userId, UUID templateId, TemplateRequest request) {
        workspaceAccessService.requireMember(wsId, userId);
        WeekTemplate template = findOwned(wsId, templateId);
        VersionGuard.requireVersion(request.version(), template.getVersion());

        String name = request.name().trim();
        if (!name.equalsIgnoreCase(template.getName())
                && weekTemplateRepository.existsByWorkspaceIdAndNameIgnoreCaseAndIdNot(wsId, name, templateId)) {
            throw new ApiException(ErrorCode.TEMPLATE_NAME_TAKEN, "Template name is already taken");
        }

        Map<UUID, TemplateEvent> existingById = template.getEvents().stream()
                .collect(Collectors.toMap(TemplateEvent::getId, Function.identity()));
        Set<UUID> requestedIds = request.events().stream()
                .map(TemplateEventRequest::id)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        for (UUID id : requestedIds) {
            if (!existingById.containsKey(id)) {
                throw new ApiException(ErrorCode.TEMPLATE_EVENT_NOT_FOUND, "Template event not found: " + id);
            }
        }

        Set<UUID> memberIds = workspaceAccessService.memberIds(wsId);
        for (TemplateEventRequest eventRequest : request.events()) {
            requireParticipantsAreMembers(eventRequest.participantIds(), memberIds);
        }

        // Remove whatever isn't in the request - orphanRemoval cascades the delete, taking exclusions with it.
        template.getEvents().removeIf(e -> !requestedIds.contains(e.getId()));

        for (TemplateEventRequest eventRequest : request.events()) {
            if (eventRequest.id() != null) {
                applyTo(existingById.get(eventRequest.id()), eventRequest);
            } else {
                template.getEvents().add(newTemplateEvent(template, eventRequest));
            }
        }

        template.setName(name);
        template.setDescription(request.description());
        template.setUpdatedAt(clock.instant());

        // flush() here - otherwise @Version only updates at commit time, after
        // this method has already returned (same situation as EventService.update).
        weekTemplateRepository.flush();
        return toResponseWithLastApplication(template);
    }

    /** Events are left alone; the application history keeps {@code templateId = null}; exclusions cascade-delete. */
    @Transactional
    public void delete(UUID wsId, UUID userId, UUID templateId, Long expectedVersion) {
        workspaceAccessService.requireMember(wsId, userId);
        WeekTemplate template = findOwned(wsId, templateId);
        VersionGuard.requireVersion(expectedVersion, template.getVersion());
        weekTemplateRepository.delete(template);
    }

    private TemplateResponse toResponseWithLastApplication(WeekTemplate template) {
        TemplateApplication lastApplication = templateApplicationRepository
                .findFirstByTemplateIdOrderByAppliedAtDesc(template.getId())
                .orElse(null);
        return templateMapper.toResponse(template, lastApplication);
    }

    private TemplateEvent newTemplateEvent(WeekTemplate template, TemplateEventRequest request) {
        return new TemplateEvent(template, request.title().trim(), request.description(), request.dayOfWeek(),
                request.startTime(), request.durationMinutes(), request.category(), request.color(), request.participantIds());
    }

    private void applyTo(TemplateEvent event, TemplateEventRequest request) {
        event.setTitle(request.title().trim());
        event.setDescription(request.description());
        event.setDayOfWeek(request.dayOfWeek());
        event.setStartTime(request.startTime());
        event.setDurationMinutes(request.durationMinutes());
        event.setCategory(request.category());
        event.setColor(request.color());
        event.setParticipantIds(new HashSet<>(request.participantIds()));
    }

    private void requireParticipantsAreMembers(Set<UUID> participantIds, Set<UUID> memberIds) {
        if (!memberIds.containsAll(participantIds)) {
            throw new ApiException(ErrorCode.EVENT_PARTICIPANT_NOT_MEMBER, "All participants must be workspace members");
        }
    }

    private WeekTemplate findOwned(UUID wsId, UUID templateId) {
        return weekTemplateRepository.findByIdAndWorkspaceId(templateId, wsId)
                .orElseThrow(() -> new ApiException(ErrorCode.TEMPLATE_NOT_FOUND, "Template not found"));
    }
}
