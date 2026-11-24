package com.togetherplanner.template.service.impl;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.template.dto.TemplateEventRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.entity.TemplateEvent;
import com.togetherplanner.template.entity.WeekTemplate;
import com.togetherplanner.template.mapper.TemplateMapper;
import com.togetherplanner.template.repository.TemplateApplicationRepository;
import com.togetherplanner.template.repository.WeekTemplateRepository;
import com.togetherplanner.workspace.service.WorkspaceAccessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Diff-by-id update logic, with mocks and a real {@code WeekTemplate} object graph - no Spring context. */
class TemplateServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-06T06:00:00Z");

    private final WeekTemplateRepository weekTemplateRepository = mock(WeekTemplateRepository.class);
    private final TemplateApplicationRepository templateApplicationRepository = mock(TemplateApplicationRepository.class);
    private final TemplateMapper templateMapper = new TemplateMapper();
    private final WorkspaceAccessService workspaceAccessService = mock(WorkspaceAccessService.class);
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final TemplateServiceImpl service = new TemplateServiceImpl(
            weekTemplateRepository, templateApplicationRepository, templateMapper, workspaceAccessService, clock);

    private final UUID wsId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID templateId = UUID.randomUUID();

    @BeforeEach
    void stubCommonCalls() {
        when(workspaceAccessService.memberIds(wsId)).thenReturn(Set.of(userId));
        when(templateApplicationRepository.findFirstByTemplateIdOrderByAppliedAtDesc(any())).thenReturn(Optional.empty());
    }

    @Test
    void updateKeepsIdOfExistingRowCreatesNewOneAndDeletesMissingOne() {
        WeekTemplate template = templateWith(templateId, "Usual week");
        TemplateEvent keep = addEvent(template, DayOfWeek.MONDAY, LocalTime.of(9, 0));
        TemplateEvent toDelete = addEvent(template, DayOfWeek.TUESDAY, LocalTime.of(9, 0));
        when(weekTemplateRepository.findByIdAndWorkspaceId(templateId, wsId)).thenReturn(Optional.of(template));

        TemplateRequest request = new TemplateRequest("Usual week", null, List.of(
                eventRequest(keep.getId(), DayOfWeek.MONDAY, LocalTime.of(10, 0)),   // has an id -> updates that row
                eventRequest(null, DayOfWeek.WEDNESDAY, LocalTime.of(8, 0))          // id == null -> creates a new row
        ), 0L);

        service.update(wsId, userId, templateId, request);

        assertThat(template.getEvents()).hasSize(2);
        assertThat(template.getEvents()).extracting(TemplateEvent::getId).contains(keep.getId());
        assertThat(template.getEvents()).extracting(TemplateEvent::getId).doesNotContain(toDelete.getId());
        TemplateEvent updatedKeep = template.getEvents().stream()
                .filter(e -> e.getId().equals(keep.getId())).findFirst().orElseThrow();
        assertThat(updatedKeep.getStartTime()).isEqualTo(LocalTime.of(10, 0));
    }

    @Test
    void foreignEventIdIsRejected() {
        WeekTemplate template = templateWith(templateId, "Usual week");
        when(weekTemplateRepository.findByIdAndWorkspaceId(templateId, wsId)).thenReturn(Optional.of(template));

        TemplateRequest request = new TemplateRequest("Usual week", null,
                List.of(eventRequest(UUID.randomUUID(), DayOfWeek.MONDAY, LocalTime.of(9, 0))), 0L);

        assertThatThrownBy(() -> service.update(wsId, userId, templateId, request))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.TEMPLATE_EVENT_NOT_FOUND);
    }

    @Test
    void mismatchedVersionIsRejected() {
        WeekTemplate template = templateWith(templateId, "Usual week");
        template.setVersion(5L);
        when(weekTemplateRepository.findByIdAndWorkspaceId(templateId, wsId)).thenReturn(Optional.of(template));

        TemplateRequest request = new TemplateRequest("Usual week", null, List.of(), 4L);

        assertThatThrownBy(() -> service.update(wsId, userId, templateId, request))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.VERSION_CONFLICT);
    }

    private WeekTemplate templateWith(UUID id, String name) {
        WeekTemplate template = new WeekTemplate(wsId, name, null, userId, NOW);
        template.setId(id);
        return template;
    }

    private TemplateEvent addEvent(WeekTemplate template, DayOfWeek dayOfWeek, LocalTime time) {
        TemplateEvent event = new TemplateEvent(template, "Event", null, dayOfWeek, time, 60,
                EventCategory.WORK, null, Set.of(userId));
        event.setId(UUID.randomUUID());
        template.getEvents().add(event);
        return event;
    }

    private TemplateEventRequest eventRequest(UUID id, DayOfWeek dayOfWeek, LocalTime time) {
        return new TemplateEventRequest(id, "Event", null, dayOfWeek, time, 60, Set.of(userId), EventCategory.WORK, null);
    }
}
