package com.togetherplanner.template;

import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.dto.NewTemplateEvent;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.service.EventService;
import com.togetherplanner.template.dto.TemplateEventRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.template.repository.OccurrenceExclusionRepository;
import com.togetherplanner.template.service.OccurrenceExclusionService;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** spec §6.3, §9.2; roadmap 7.2. */
class OccurrenceExclusionIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 11, 9);

    @Autowired
    private EventService eventService;

    @Autowired
    private OccurrenceExclusionService occurrenceExclusionService;

    @Autowired
    private OccurrenceExclusionRepository occurrenceExclusionRepository;

    @Test
    void deletingASourcedEventCreatesAnExclusion() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        TemplateResponse template = testApi.createTemplate(alice.accessToken(), workspace.id(), templateRequest(alice.userId()));
        UUID templateEventId = template.events().get(0).id();

        EventResponse sourced = createSourcedEvent(workspace.id(), alice.userId(), templateEventId, template.name());

        testApi.deleteEvent(alice.accessToken(), workspace.id(), sourced.id(), sourced.version())
                .andExpect(status().isNoContent());

        assertThat(occurrenceExclusionService.excludedFor(WEEK_START, Set.of(templateEventId)))
                .containsExactly(templateEventId);
    }

    @Test
    void deletingAManualEventCreatesNoExclusion() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        long before = occurrenceExclusionRepository.count();

        EventResponse manual = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Doctor", null, LocalDateTime.of(2026, 11, 9, 10, 0), LocalDateTime.of(2026, 11, 9, 11, 0),
                Set.of(alice.userId()), EventCategory.REST, null, null));

        testApi.deleteEvent(alice.accessToken(), workspace.id(), manual.id(), manual.version())
                .andExpect(status().isNoContent());

        assertThat(occurrenceExclusionRepository.count()).isEqualTo(before);
    }

    @Test
    void deletingASourcedEventWhoseTemplateEventIsGoneSucceedsWithoutExclusion() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        TemplateResponse template = testApi.createTemplate(alice.accessToken(), workspace.id(), templateRequest(alice.userId()));
        UUID templateEventId = template.events().get(0).id();
        EventResponse sourced = createSourcedEvent(workspace.id(), alice.userId(), templateEventId, template.name());

        testApi.deleteTemplate(alice.accessToken(), workspace.id(), template.id(), template.version())
                .andExpect(status().isNoContent());

        testApi.deleteEvent(alice.accessToken(), workspace.id(), sourced.id(), sourced.version())
                .andExpect(status().isNoContent());

        assertThat(occurrenceExclusionService.excludedFor(WEEK_START, Set.of(templateEventId))).isEmpty();
    }

    private EventResponse createSourcedEvent(UUID wsId, UUID userId, UUID templateEventId, String templateName) {
        return eventService.createFromTemplate(wsId, userId, List.of(new NewTemplateEvent(
                "Work", null, LocalDateTime.of(2026, 11, 9, 9, 0), LocalDateTime.of(2026, 11, 9, 13, 0),
                Set.of(), EventCategory.WORK, null, templateEventId, WEEK_START, templateName))).get(0);
    }

    private TemplateRequest templateRequest(UUID userId) {
        return new TemplateRequest("Usual week", null, List.of(new TemplateEventRequest(
                null, "Work", null, DayOfWeek.MONDAY, LocalTime.of(9, 0), 240,
                Set.of(userId), EventCategory.WORK, null)), null);
    }
}
