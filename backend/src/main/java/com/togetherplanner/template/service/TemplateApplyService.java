package com.togetherplanner.template.service;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.common.web.PageResponse;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.dto.NewTemplateEvent;
import com.togetherplanner.event.service.EventService;
import com.togetherplanner.template.dto.ApplyPlan;
import com.togetherplanner.template.dto.ApplyPreviewResponse;
import com.togetherplanner.template.dto.ApplyResultResponse;
import com.togetherplanner.template.dto.ApplyTemplateRequest;
import com.togetherplanner.template.dto.PlanInput;
import com.togetherplanner.template.dto.PlannedEvent;
import com.togetherplanner.template.dto.TemplateApplicationResponse;
import com.togetherplanner.template.dto.TemplateEventResponse;
import com.togetherplanner.template.entity.ApplyMode;
import com.togetherplanner.template.entity.TemplateApplication;
import com.togetherplanner.template.entity.TemplateEvent;
import com.togetherplanner.template.entity.WeekTemplate;
import com.togetherplanner.template.mapper.TemplateMapper;
import com.togetherplanner.template.repository.TemplateApplicationRepository;
import com.togetherplanner.template.repository.WeekTemplateRepository;
import com.togetherplanner.workspace.service.WorkspaceAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * T6/T7/T8 (spec §8.8, §9.5). {@code preview} и {@code apply} делят один
 * {@code buildPlan} — поэтому их бизнес-правила не могут разойтись.
 */
@Service
@RequiredArgsConstructor
public class TemplateApplyService {

    private final WeekTemplateRepository weekTemplateRepository;
    private final TemplateApplicationRepository templateApplicationRepository;
    private final TemplateMapper templateMapper;
    private final WorkspaceAccessService workspaceAccessService;
    private final EventService eventService;
    private final OccurrenceExclusionService occurrenceExclusionService;
    private final Clock clock;

    private final ApplyPlanner applyPlanner = new ApplyPlanner();

    /** T6: без блокировки, ничего не меняет (spec §9.5). */
    @Transactional(readOnly = true)
    public ApplyPreviewResponse preview(UUID wsId, UUID userId, UUID templateId, ApplyTemplateRequest request) {
        workspaceAccessService.requireMember(wsId, userId);
        WeekTemplate template = findOwned(wsId, templateId);
        requireMonday(request.weekStart());

        ApplyPlan plan = buildPlan(wsId, template, request.weekStart(), request.mode(), request.includeManual());
        return new ApplyPreviewResponse(request.weekStart(), request.mode(), plan.toCreate(), plan.skippedAlreadyApplied(),
                plan.skippedDeleted(), plan.skippedBusy(), plan.restoredDeleted(), plan.conflicts(), plan.toDelete(),
                plan.manualEventsInWeek());
    }

    /** T7 (spec §9.5, шаги 1–11). */
    @Transactional
    public ApplyResultResponse apply(UUID wsId, UUID userId, UUID templateId, ApplyTemplateRequest request) {
        workspaceAccessService.requireMember(wsId, userId);
        WeekTemplate template = findOwned(wsId, templateId);
        requireMonday(request.weekStart());
        if (request.mode() == ApplyMode.REPLACE
                && (request.confirmedDeleteIds() == null || request.confirmedRestoredIds() == null)) {
            throw new ApiException(ErrorCode.REPLACE_CONFIRMATION_REQUIRED,
                    "confirmedDeleteIds and confirmedRestoredIds are required for REPLACE");
        }

        // Блокировка ДО чтения событий — иначе план строится по устаревшим данным (spec §9.5, шаг 3).
        workspaceAccessService.lockForUpdate(wsId);

        ApplyPlan plan = buildPlan(wsId, template, request.weekStart(), request.mode(), request.includeManual());

        if (request.mode() == ApplyMode.REPLACE) {
            Set<UUID> deleteIds = plan.toDelete().stream().map(EventResponse::id).collect(Collectors.toSet());
            Set<UUID> restoredIds = plan.restoredDeleted().stream().map(PlannedEvent::templateEventId).collect(Collectors.toSet());
            if (!deleteIds.equals(request.confirmedDeleteIds()) || !restoredIds.equals(request.confirmedRestoredIds())) {
                throw new ApiException(ErrorCode.APPLY_PLAN_OUTDATED,
                        "The apply plan changed since the preview; request a new preview");
            }
        }

        // flush() внутри — ОБЯЗАТЕЛЬНО до createFromTemplate (spec §9.5, шаг 7; A-02).
        eventService.deleteForTemplateReplace(wsId, plan.toDelete().stream().map(EventResponse::id).toList());

        if (request.mode() == ApplyMode.REPLACE) {
            List<UUID> templateEventIds = template.getEvents().stream().map(TemplateEvent::getId).toList();
            occurrenceExclusionService.clear(request.weekStart(), templateEventIds);
        }

        List<NewTemplateEvent> newEvents = plan.toCreate().stream()
                .map(planned -> toNewTemplateEvent(planned, request.weekStart(), template.getName()))
                .toList();
        List<EventResponse> created = eventService.createFromTemplate(wsId, userId, newEvents);

        int skippedCount = plan.skippedAlreadyApplied().size() + plan.skippedDeleted().size() + plan.skippedBusy().size();
        TemplateApplication application = new TemplateApplication(wsId, template.getId(), template.getName(),
                request.weekStart(), request.mode(), created.size(), skippedCount, plan.toDelete().size(),
                userId, clock.instant());
        TemplateApplication saved = templateApplicationRepository.save(application);

        return new ApplyResultResponse(templateMapper.toApplicationResponse(saved), created);
    }

    /** T8: история применений по пространству. */
    @Transactional(readOnly = true)
    public PageResponse<TemplateApplicationResponse> history(UUID wsId, UUID userId, Pageable pageable) {
        workspaceAccessService.requireMember(wsId, userId);
        return PageResponse.of(templateApplicationRepository.findByWorkspaceIdOrderByAppliedAtDesc(wsId, pageable),
                templateMapper::toApplicationResponse);
    }

    /** Публичный метод — spec §6.4. Вызывается {@code schedule} (этап 8); членство уже проверено вызывающим. */
    @Transactional(readOnly = true)
    public List<TemplateApplicationResponse> findApplicationsForWeek(UUID wsId, LocalDate weekStart) {
        return templateApplicationRepository.findByWorkspaceIdAndWeekStartOrderByAppliedAt(wsId, weekStart).stream()
                .map(templateMapper::toApplicationResponse)
                .toList();
    }

    /** spec §9.3: окно 14 дней, отдельный запрос по метке происхождения, исключения для {@code weekStart}. */
    private ApplyPlan buildPlan(UUID wsId, WeekTemplate template, LocalDate weekStart, ApplyMode mode, boolean includeManual) {
        ZoneId zone = workspaceAccessService.zoneOf(wsId);
        List<TemplateEventResponse> templateEvents = template.getEvents().stream()
                .map(templateMapper::toEventResponse)
                .toList();
        List<UUID> templateEventIds = templateEvents.stream().map(TemplateEventResponse::id).toList();

        LocalDateTime windowFrom = weekStart.atStartOfDay();
        LocalDateTime windowTo = windowFrom.plusDays(14);
        List<EventResponse> windowEvents = eventService.findOverlapping(wsId, windowFrom, windowTo);
        List<EventResponse> sameWeekSourced = eventService.findBySourceWeek(wsId, weekStart, templateEventIds);
        Set<UUID> excluded = occurrenceExclusionService.excludedFor(weekStart, templateEventIds);

        PlanInput input = new PlanInput(weekStart, zone, mode, includeManual, templateEvents, windowEvents,
                sameWeekSourced, excluded);
        return applyPlanner.plan(input);
    }

    private NewTemplateEvent toNewTemplateEvent(PlannedEvent planned, LocalDate weekStart, String templateName) {
        return new NewTemplateEvent(planned.title(), planned.description(), planned.start(), planned.end(),
                planned.participantIds(), planned.category(), planned.color(), planned.templateEventId(),
                weekStart, templateName);
    }

    private void requireMonday(LocalDate weekStart) {
        if (weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new ApiException(ErrorCode.WEEK_START_NOT_MONDAY, "weekStart must be a Monday");
        }
    }

    private WeekTemplate findOwned(UUID wsId, UUID templateId) {
        return weekTemplateRepository.findByIdAndWorkspaceId(templateId, wsId)
                .orElseThrow(() -> new ApiException(ErrorCode.TEMPLATE_NOT_FOUND, "Template not found"));
    }
}
