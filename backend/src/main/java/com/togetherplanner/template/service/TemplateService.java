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

/** T1–T5 (spec §8.7). T6–T8 (применение) — этапы 6–7. */
@Service
@RequiredArgsConstructor
public class TemplateService {

    private final WeekTemplateRepository weekTemplateRepository;
    private final TemplateApplicationRepository templateApplicationRepository;
    private final TemplateMapper templateMapper;
    private final WorkspaceAccessService workspaceAccessService;
    private final Clock clock;

    /** T1: шаблоны отдаются целиком, по {@code name}. */
    @Transactional(readOnly = true)
    public List<TemplateResponse> list(UUID wsId, UUID userId) {
        workspaceAccessService.requireMember(wsId, userId);
        return weekTemplateRepository.findByWorkspaceIdOrderByName(wsId).stream()
                .map(this::toResponseWithLastApplication)
                .toList();
    }

    /** T2: {@code name} — trim; {@code id != null} в новых событиях отклоняется как ошибка валидации. */
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

    /** T3. */
    @Transactional(readOnly = true)
    public TemplateResponse get(UUID wsId, UUID userId, UUID templateId) {
        workspaceAccessService.requireMember(wsId, userId);
        return toResponseWithLastApplication(findOwned(wsId, templateId));
    }

    /** T4: diff по id (spec §9.8). Созданные из шаблона события не меняются (R-7) — этот метод Event не трогает. */
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

        // Удалить то, чего нет в запросе — orphanRemoval доделает каскад (исключения уйдут с ним же).
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

        // flush() — иначе @Version обновится только при коммите, после того как
        // метод уже вернул ответ (тот же случай, что EventService.update, этап 4.3).
        weekTemplateRepository.flush();
        return toResponseWithLastApplication(template);
    }

    /** T5: события остаются, в истории {@code templateId = null}; исключения удаляются каскадом. */
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
