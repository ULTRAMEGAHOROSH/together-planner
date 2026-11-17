package com.togetherplanner.schedule;

import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.schedule.dto.WeekResponse;
import com.togetherplanner.template.dto.ApplyTemplateRequest;
import com.togetherplanner.template.dto.TemplateEventRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.template.entity.ApplyMode;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WeekIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 11, 9);

    @Test
    void futureEventAppearsOnlyInItsOwnWeek() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser bob = testApi.register("bob@example.com", "Bob");
        testApi.join(bob.accessToken(), testApi.createInvite(alice.accessToken(), workspace.id()).code())
                .andExpect(status().isOk());

        EventResponse trip = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Поездка", null, LocalDateTime.of(2026, 11, 20, 8, 0), LocalDateTime.of(2026, 11, 20, 20, 0),
                Set.of(alice.userId(), bob.userId()), EventCategory.TRIP, null, null));

        WeekResponse weekOf16 = testApi.getWeek(alice.accessToken(), workspace.id(), LocalDate.of(2026, 11, 16));
        assertThat(weekOf16.events()).extracting(EventResponse::id).contains(trip.id());

        WeekResponse weekOf09 = testApi.getWeek(alice.accessToken(), workspace.id(), WEEK_START);
        assertThat(weekOf09.events()).extracting(EventResponse::id).doesNotContain(trip.id());
    }

    @Test
    void eventsCrossingMidnightLandInTheCorrectWeeksAndTheBoundaryIsHalfOpen() throws Exception {
        RegisteredUser alice = testApi.register("alice2@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        EventResponse fridayNight = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Night shift", null, LocalDateTime.of(2026, 11, 13, 23, 0), LocalDateTime.of(2026, 11, 14, 7, 0),
                Set.of(alice.userId()), EventCategory.WORK, null, null));
        EventResponse sundayIntoNextWeek = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Sleep", null, LocalDateTime.of(2026, 11, 15, 23, 0), LocalDateTime.of(2026, 11, 16, 7, 0),
                Set.of(alice.userId()), EventCategory.SLEEP, null, null));
        EventResponse endingExactlyAtNextMonday = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Late evening", null, LocalDateTime.of(2026, 11, 15, 20, 0), LocalDateTime.of(2026, 11, 16, 0, 0),
                Set.of(alice.userId()), EventCategory.REST, null, null));

        WeekResponse weekW = testApi.getWeek(alice.accessToken(), workspace.id(), WEEK_START);
        assertThat(weekW.events()).extracting(EventResponse::id)
                .contains(fridayNight.id(), sundayIntoNextWeek.id(), endingExactlyAtNextMonday.id());

        WeekResponse weekNext = testApi.getWeek(alice.accessToken(), workspace.id(), LocalDate.of(2026, 11, 16));
        assertThat(weekNext.events()).extracting(EventResponse::id).contains(sundayIntoNextWeek.id());
        assertThat(weekNext.events()).extracting(EventResponse::id)
                .doesNotContain(fridayNight.id(), endingExactlyAtNextMonday.id());
    }

    @Test
    void dateDefaultsToTodayInTheWorkspaceTimeZoneRoundedToMonday() throws Exception {
        clock.setInstant(Instant.parse("2026-11-12T05:00:00Z")); // Asia/Almaty is UTC+5 -> local Nov 12 10:00 (Thursday)
        RegisteredUser alice = testApi.register("alice3@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        WeekResponse week = testApi.getWeek(alice.accessToken(), workspace.id(), null);

        assertThat(week.weekStart()).isEqualTo(WEEK_START);
        assertThat(week.weekEnd()).isEqualTo(WEEK_START.plusDays(6));
        assertThat(week.timeZone()).isEqualTo("Asia/Almaty");
    }

    @Test
    void appliedTemplatesListsApplicationsForThatWeek() throws Exception {
        RegisteredUser alice = testApi.register("alice4@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        TemplateResponse template = testApi.createTemplate(alice.accessToken(), workspace.id(), new TemplateRequest(
                "Usual week", null, List.of(new TemplateEventRequest(null, "t1", null, DayOfWeek.MONDAY,
                        LocalTime.of(9, 0), 240, Set.of(alice.userId()), EventCategory.WORK, null)), null));
        testApi.applyTemplate(alice.accessToken(), workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));

        WeekResponse week = testApi.getWeek(alice.accessToken(), workspace.id(), WEEK_START);

        assertThat(week.appliedTemplates()).hasSize(1);
        assertThat(week.appliedTemplates().get(0).templateName()).isEqualTo("Usual week");
        assertThat(week.appliedTemplates().get(0).mode()).isEqualTo(ApplyMode.MERGE);
        assertThat(week.appliedTemplates().get(0).createdCount()).isEqualTo(1);

        WeekResponse otherWeek = testApi.getWeek(alice.accessToken(), workspace.id(), WEEK_START.plusWeeks(1));
        assertThat(otherWeek.appliedTemplates()).isEmpty();
    }

    @Test
    void weekOfSomeoneElsesWorkspaceReturns404() throws Exception {
        RegisteredUser alice = testApi.register("alice5@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser mallory = testApi.register("mallory5@example.com", "Mallory");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + workspace.id() + "/week")
                        .header("Authorization", "Bearer " + mallory.accessToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
    }
}
