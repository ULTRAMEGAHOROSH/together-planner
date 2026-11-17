package com.togetherplanner.event;

import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EventRangeAndUpcomingIT extends AbstractIntegrationTest {

    @Test
    void rangeOf94DaysIsRejected() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        LocalDate from = LocalDate.of(2026, 11, 9);
        LocalDate to94 = from.plusDays(93);   // 94 days inclusive

        mockMvc.perform(get("/api/v1/workspaces/" + workspace.id() + "/events")
                        .param("from", from.toString())
                        .param("to", to94.toString())
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_DATE_RANGE"));
    }

    @Test
    void rangeOf93DaysIsAccepted() throws Exception {
        RegisteredUser alice = testApi.register("alice2@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        LocalDate from = LocalDate.of(2026, 11, 9);
        LocalDate to93 = from.plusDays(92);   // 93 days inclusive

        mockMvc.perform(get("/api/v1/workspaces/" + workspace.id() + "/events")
                        .param("from", from.toString())
                        .param("to", to93.toString())
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void upcomingIncludesOngoingAndFutureButNotPastWithCorrectPaging() throws Exception {
        RegisteredUser alice = testApi.register("alice3@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        // Asia/Almaty is UTC+5, so local "now" is 10:00.
        clock.setInstant(Instant.parse("2026-11-06T05:00:00Z"));

        EventResponse past = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Past", null, LocalDateTime.of(2026, 11, 6, 7, 0), LocalDateTime.of(2026, 11, 6, 8, 0),
                Set.of(alice.userId()), EventCategory.WORK, null, null));
        EventResponse ongoing = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Ongoing", null, LocalDateTime.of(2026, 11, 6, 9, 0), LocalDateTime.of(2026, 11, 6, 11, 0),
                Set.of(alice.userId()), EventCategory.WORK, null, null));
        EventResponse future = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Future", null, LocalDateTime.of(2026, 11, 7, 9, 0), LocalDateTime.of(2026, 11, 7, 10, 0),
                Set.of(alice.userId()), EventCategory.WORK, null, null));

        mockMvc.perform(get("/api/v1/workspaces/" + workspace.id() + "/events/upcoming")
                        .param("page", "0").param("size", "1")
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(ongoing.id().toString()))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.hasNext").value(true));

        mockMvc.perform(get("/api/v1/workspaces/" + workspace.id() + "/events/upcoming")
                        .param("page", "1").param("size", "1")
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(future.id().toString()))
                .andExpect(jsonPath("$.hasNext").value(false));

        assertThat(past.title()).isEqualTo("Past");
    }

    @Test
    void upcomingSizeOutOfRangeIsRejected() throws Exception {
        RegisteredUser alice = testApi.register("alice4@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        mockMvc.perform(get("/api/v1/workspaces/" + workspace.id() + "/events/upcoming")
                        .param("size", "101")
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
