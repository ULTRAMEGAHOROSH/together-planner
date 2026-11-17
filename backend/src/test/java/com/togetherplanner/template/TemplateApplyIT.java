package com.togetherplanner.template;

import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.template.dto.ApplyPreviewResponse;
import com.togetherplanner.template.dto.ApplyResultResponse;
import com.togetherplanner.template.dto.ApplyTemplateRequest;
import com.togetherplanner.template.dto.PlannedEvent;
import com.togetherplanner.template.dto.TemplateEventRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.template.entity.ApplyMode;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Fixture: template T "Usual week" (t1-t4) applied to week W = 2026-11-09 (Mon) - 11-15 (Sun). */
class TemplateApplyIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 11, 9);

    @Test
    void mergeToEmptyWeekCreatesAllFourOccurrences() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("1");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");

        ApplyResultResponse result = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));

        assertThat(result.createdEvents()).hasSize(4);
        assertThat(result.application().mode()).isEqualTo(ApplyMode.MERGE);
        assertThat(result.application().createdCount()).isEqualTo(4);
        assertThat(result.application().skippedCount()).isEqualTo(0);
        assertThat(result.application().deletedCount()).isEqualTo(0);
    }

    @Test
    void reapplyingMergeSkipsAllFourAndLogsASecondEntry() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("2");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));

        ApplyResultResponse second = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));

        assertThat(second.createdEvents()).isEmpty();
        assertThat(second.application().createdCount()).isEqualTo(0);
        assertThat(second.application().skippedCount()).isEqualTo(4);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + ws.workspace.id() + "/template-applications")
                        .header("Authorization", "Bearer " + ws.alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void movingACreatedOccurrenceThenReapplyingMergeCausesNoConflictAndNoDuplicate() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("3");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        ApplyResultResponse first = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        UUID t1 = template.events().get(0).id();
        EventResponse e1 = eventFor(first.createdEvents(), t1);

        testApi.putEvent(ws.alice.accessToken(), ws.workspace.id(), e1.id(), new EventRequest(
                        e1.title(), e1.description(), LocalDateTime.of(2026, 11, 17, 9, 0), LocalDateTime.of(2026, 11, 17, 13, 0),
                        e1.participantIds(), e1.category(), e1.color(), e1.version()))
                .andExpect(status().isOk());

        ApplyResultResponse second = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));

        assertThat(second.createdEvents()).isEmpty();
        assertThat(second.application().createdCount()).isEqualTo(0);
        assertThat(second.application().skippedCount()).isEqualTo(4);
    }

    @Test
    void changingTheTemplateAfterApplyingDoesNotChangeExistingEvents() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("4");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        UUID t1 = template.events().get(0).id();

        List<EventResponse> before = testApi.listEvents(ws.alice.accessToken(), ws.workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        EventResponse e1Before = eventFor(before, t1);

        TemplateEventRequest changedT1 = new TemplateEventRequest(t1, "t1", null, DayOfWeek.MONDAY, LocalTime.of(10, 0), 240,
                Set.of(ws.alice.userId()), EventCategory.WORK, null);
        List<TemplateEventRequest> keptEvents = template.events().stream()
                .skip(1)
                .map(e -> new TemplateEventRequest(e.id(), e.title(), e.description(), e.dayOfWeek(), e.startTime(),
                        e.durationMinutes(), e.participantIds(), e.category(), e.color()))
                .collect(Collectors.toCollection(java.util.ArrayList::new));
        keptEvents.add(0, changedT1);
        testApi.putTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                        new TemplateRequest(template.name(), template.description(), keptEvents, template.version()))
                .andExpect(status().isOk());

        List<EventResponse> after = testApi.listEvents(ws.alice.accessToken(), ws.workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        EventResponse e1After = eventFor(after, t1);
        assertThat(e1After.start()).isEqualTo(e1Before.start());
    }

    @Test
    void deletedOccurrenceIsNotRecreatedByMerge() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("5");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        ApplyResultResponse first = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        UUID t3 = template.events().get(2).id();
        EventResponse e3 = eventFor(first.createdEvents(), t3);
        testApi.deleteEvent(ws.alice.accessToken(), ws.workspace.id(), e3.id(), e3.version()).andExpect(status().isNoContent());

        ApplyPreviewResponse preview = testApi.previewApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        assertThat(preview.skippedDeleted()).extracting("templateEventId").containsExactly(t3);
        assertThat(preview.toCreate()).isEmpty();

        ApplyResultResponse second = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        assertThat(second.createdEvents()).isEmpty();

        List<EventResponse> events = testApi.listEvents(ws.alice.accessToken(), ws.workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        assertThat(events).noneMatch(e -> e.source() != null && e.source().templateEventId().equals(t3));
    }

    @Test
    void replaceAfterMergeDeletesAndRecreatesAllFourWithoutUniquenessError() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("6");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));

        ApplyPreviewResponse preview = testApi.previewApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, false, null, null));
        Set<UUID> deleteIds = preview.toDelete().stream().map(EventResponse::id).collect(Collectors.toSet());
        Set<UUID> restoredIds = preview.restoredDeleted().stream()
                .map(PlannedEvent::templateEventId).collect(Collectors.toSet());
        assertThat(deleteIds).hasSize(4);
        assertThat(restoredIds).isEmpty();

        ApplyResultResponse replaced = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, false, deleteIds, restoredIds));

        assertThat(replaced.application().deletedCount()).isEqualTo(4);
        assertThat(replaced.application().createdCount()).isEqualTo(4);
        assertThat(replaced.createdEvents()).hasSize(4);
    }

    @Test
    void outdatedDeletePlanIsRejectedAndChangesNothing() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("7");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));

        ApplyPreviewResponse stalePreview = testApi.previewApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, true, null, null));
        Set<UUID> staleDeleteIds = stalePreview.toDelete().stream().map(EventResponse::id).collect(Collectors.toSet());
        assertThat(staleDeleteIds).hasSize(4);

        // The partner creates a manual event starting within week W - a fresh REPLACE(includeManual) would delete it too.
        testApi.createEvent(ws.bob.accessToken(), ws.workspace.id(), new EventRequest(
                "Dentist", null, LocalDateTime.of(2026, 11, 10, 14, 0), LocalDateTime.of(2026, 11, 10, 15, 0),
                Set.of(ws.bob.userId()), EventCategory.WORK, null, null));

        testApi.postApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                        new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, true, staleDeleteIds, Set.of()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPLY_PLAN_OUTDATED"));

        List<EventResponse> events = testApi.listEvents(ws.alice.accessToken(), ws.workspace.id(), WEEK_START, WEEK_START.plusDays(13));
        assertThat(events).hasSize(5); // 4 occurrences from MERGE plus "Dentist" - nothing deleted, nothing created
    }

    @Test
    void deletingTheTemplateKeepsEventsAndNullsTemplateIdInHistory() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("8");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));

        testApi.deleteTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(), template.version())
                .andExpect(status().isNoContent());

        List<EventResponse> events = testApi.listEvents(ws.alice.accessToken(), ws.workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        assertThat(events).hasSize(4);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + ws.workspace.id() + "/template-applications")
                        .header("Authorization", "Bearer " + ws.alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].templateId").doesNotExist())
                .andExpect(jsonPath("$.items[0].templateName").value("Usual week"));
    }

    @Test
    void restoringADeletedOccurrenceRequiresAConfirmedReplace() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("9");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        ApplyResultResponse first = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        UUID t3 = template.events().get(2).id();
        EventResponse e3 = eventFor(first.createdEvents(), t3);
        testApi.deleteEvent(ws.alice.accessToken(), ws.workspace.id(), e3.id(), e3.version()).andExpect(status().isNoContent());

        ApplyPreviewResponse mergePreview = testApi.previewApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        assertThat(mergePreview.skippedDeleted()).extracting("templateEventId").containsExactly(t3);
        assertThat(mergePreview.restoredDeleted()).isEmpty();

        ApplyPreviewResponse replacePreview = testApi.previewApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, false, null, null));
        assertThat(replacePreview.restoredDeleted()).extracting("templateEventId").containsExactly(t3);
        Set<UUID> deleteIds = replacePreview.toDelete().stream().map(EventResponse::id).collect(Collectors.toSet());
        assertThat(deleteIds).hasSize(3); // e1, e2, e4 - e3 is already gone

        testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, false, deleteIds, Set.of(t3)));

        List<EventResponse> events = testApi.listEvents(ws.alice.accessToken(), ws.workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        assertThat(events).anyMatch(e -> e.source() != null && e.source().templateEventId().equals(t3));

        ApplyPreviewResponse finalMerge = testApi.previewApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        assertThat(finalMerge.toCreate()).isEmpty();
        assertThat(finalMerge.skippedDeleted()).isEmpty();
        assertThat(finalMerge.skippedAlreadyApplied()).hasSize(4);
    }

    @Test
    void restoringWithoutShowingItInThePreviewFirstIsRejected() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("10");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        ApplyResultResponse first = testApi.applyTemplate(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        UUID t1 = template.events().get(0).id();
        EventResponse e1 = eventFor(first.createdEvents(), t1);

        testApi.putEvent(ws.alice.accessToken(), ws.workspace.id(), e1.id(), new EventRequest(
                        e1.title(), e1.description(), LocalDateTime.of(2026, 11, 17, 9, 0), LocalDateTime.of(2026, 11, 17, 13, 0),
                        e1.participantIds(), e1.category(), e1.color(), e1.version()))
                .andExpect(status().isOk());

        ApplyPreviewResponse preview = testApi.previewApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, false, null, null));
        assertThat(preview.restoredDeleted()).isEmpty();
        Set<UUID> staleDeleteIds = preview.toDelete().stream().map(EventResponse::id).collect(Collectors.toSet());
        assertThat(staleDeleteIds).hasSize(3); // e2, e3, e4 - e1 was moved out of the week

        EventResponse movedE1 = eventFor(
                testApi.listEvents(ws.alice.accessToken(), ws.workspace.id(), LocalDate.of(2026, 11, 17), LocalDate.of(2026, 11, 17)),
                t1);
        testApi.deleteEvent(ws.bob.accessToken(), ws.workspace.id(), movedE1.id(), movedE1.version())
                .andExpect(status().isNoContent());

        testApi.postApply(ws.alice.accessToken(), ws.workspace.id(), template.id(),
                        new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, false, staleDeleteIds, Set.of()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPLY_PLAN_OUTDATED"));

        List<EventResponse> eventsInW = testApi.listEvents(ws.alice.accessToken(), ws.workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        assertThat(eventsInW).extracting(EventResponse::id).doesNotContain(movedE1.id()); // not restored
    }

    @Test
    void applyEndpointsOnSomeoneElsesWorkspaceReturn404() throws Exception {
        TwoMemberWorkspace ws = twoMemberWorkspace("11");
        TemplateResponse template = createUsualWeekTemplate(ws, "Usual week");
        RegisteredUser mallory = testApi.register("mallory11@example.com", "Mallory");

        testApi.postApplyPreview(mallory.accessToken(), ws.workspace.id(), template.id(),
                        new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));

        testApi.postApply(mallory.accessToken(), ws.workspace.id(), template.id(),
                        new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + ws.workspace.id() + "/template-applications")
                        .header("Authorization", "Bearer " + mallory.accessToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
    }

    private EventResponse eventFor(List<EventResponse> events, UUID templateEventId) {
        return events.stream()
                .filter(e -> e.source() != null && e.source().templateEventId().equals(templateEventId))
                .findFirst()
                .orElseThrow();
    }

    private TwoMemberWorkspace twoMemberWorkspace(String suffix) throws Exception {
        RegisteredUser alice = testApi.register("alice" + suffix + "@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser bob = testApi.register("bob" + suffix + "@example.com", "Bob");
        testApi.join(bob.accessToken(), testApi.createInvite(alice.accessToken(), workspace.id()).code())
                .andExpect(status().isOk());
        return new TwoMemberWorkspace(alice, bob, workspace);
    }

    /** The "Usual week" template: t1 MON 09:00+240 [A], t2 MON 23:00+480 [A,B], t3 FRI 19:00+120 [A,B], t4 SUN 23:00+480 [A]. */
    private TemplateResponse createUsualWeekTemplate(TwoMemberWorkspace ws, String name) throws Exception {
        UUID a = ws.alice.userId();
        UUID b = ws.bob.userId();
        TemplateRequest request = new TemplateRequest(name, null, List.of(
                new TemplateEventRequest(null, "t1", null, DayOfWeek.MONDAY, LocalTime.of(9, 0), 240, Set.of(a), EventCategory.WORK, null),
                new TemplateEventRequest(null, "t2", null, DayOfWeek.MONDAY, LocalTime.of(23, 0), 480, Set.of(a, b), EventCategory.WORK, null),
                new TemplateEventRequest(null, "t3", null, DayOfWeek.FRIDAY, LocalTime.of(19, 0), 120, Set.of(a, b), EventCategory.WORK, null),
                new TemplateEventRequest(null, "t4", null, DayOfWeek.SUNDAY, LocalTime.of(23, 0), 480, Set.of(a), EventCategory.WORK, null)
        ), null);
        return testApi.createTemplate(ws.alice.accessToken(), ws.workspace.id(), request);
    }

    private record TwoMemberWorkspace(RegisteredUser alice, RegisteredUser bob, WorkspaceResponse workspace) {
    }
}
