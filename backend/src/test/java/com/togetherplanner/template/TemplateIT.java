package com.togetherplanner.template;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.template.dto.TemplateEventRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** spec §8.7 (T1–T5); roadmap 5.2. */
class TemplateIT extends AbstractIntegrationTest {

    @Test
    void createListGetUpdateAndDeleteHappyPath() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        TemplateRequest createRequest = new TemplateRequest("Usual week", "desc",
                List.of(eventRequest(null, DayOfWeek.MONDAY, LocalTime.of(9, 0), alice.userId())), null);
        TemplateResponse created = testApi.createTemplate(alice.accessToken(), workspace.id(), createRequest);
        assertThat(created.name()).isEqualTo("Usual week");
        assertThat(created.events()).hasSize(1);
        assertThat(created.lastApplication()).isNull();
        assertThat(created.version()).isEqualTo(0L);
        UUID keptEventId = created.events().get(0).id();

        testApi.postTemplate(alice.accessToken(), workspace.id(),
                        new TemplateRequest("Other", null, List.of(), null))
                .andExpect(status().isCreated());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + workspace.id() + "/templates")
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Other"))      // по name: "Other" < "Usual week"
                .andExpect(jsonPath("$[1].name").value("Usual week"));

        TemplateResponse fetched = testApi.getTemplate(alice.accessToken(), workspace.id(), created.id());
        assertThat(fetched.id()).isEqualTo(created.id());

        TemplateRequest updateRequest = new TemplateRequest("Renamed", "new desc", List.of(
                eventRequest(keptEventId, DayOfWeek.MONDAY, LocalTime.of(10, 0), alice.userId()),  // id есть -> обновить
                eventRequest(null, DayOfWeek.WEDNESDAY, LocalTime.of(8, 0), alice.userId())        // id == null -> создать
        ), created.version());
        testApi.putTemplate(alice.accessToken(), workspace.id(), created.id(), updateRequest)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"))
                .andExpect(jsonPath("$.events.length()").value(2))
                .andExpect(jsonPath("$.events[0].id").value(keptEventId.toString()))  // Monday сортируется первым
                .andExpect(jsonPath("$.version").value(1));

        testApi.deleteTemplate(alice.accessToken(), workspace.id(), created.id(), 1L)
                .andExpect(status().isNoContent());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + workspace.id() + "/templates/" + created.id())
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    void duplicateNameIsRejectedRegardlessOfCase() throws Exception {
        RegisteredUser alice = testApi.register("alice2@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        testApi.createTemplate(alice.accessToken(), workspace.id(), new TemplateRequest("Usual week", null, List.of(), null));

        testApi.postTemplate(alice.accessToken(), workspace.id(),
                        new TemplateRequest("USUAL WEEK", null, List.of(), null))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TEMPLATE_NAME_TAKEN"));
    }

    @Test
    void renamingToItsOwnNameWithDifferentCaseIsAllowed() throws Exception {
        RegisteredUser alice = testApi.register("alice3@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        TemplateResponse created = testApi.createTemplate(alice.accessToken(), workspace.id(),
                new TemplateRequest("Usual week", null, List.of(), null));

        testApi.putTemplate(alice.accessToken(), workspace.id(), created.id(),
                        new TemplateRequest("USUAL WEEK", null, List.of(), created.version()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("USUAL WEEK"));
    }

    @Test
    void foreignTemplateEventIdOnUpdateIsRejected() throws Exception {
        RegisteredUser alice = testApi.register("alice4@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        TemplateResponse created = testApi.createTemplate(alice.accessToken(), workspace.id(),
                new TemplateRequest("Usual week", null, List.of(), null));

        testApi.putTemplate(alice.accessToken(), workspace.id(), created.id(),
                        new TemplateRequest("Usual week", null,
                                List.of(eventRequest(UUID.randomUUID(), DayOfWeek.MONDAY, LocalTime.of(9, 0), alice.userId())),
                                created.version()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TEMPLATE_EVENT_NOT_FOUND"));
    }

    // I-24
    @Test
    void deleteVersionCases() throws Exception {
        RegisteredUser alice = testApi.register("alice5@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        TemplateResponse created = testApi.createTemplate(alice.accessToken(), workspace.id(),
                new TemplateRequest("Usual week", null, List.of(), null));

        testApi.deleteTemplate(alice.accessToken(), workspace.id(), created.id(), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));

        testApi.deleteTemplate(alice.accessToken(), workspace.id(), created.id(), 99L)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));

        testApi.getTemplate(alice.accessToken(), workspace.id(), created.id()); // ещё существует

        testApi.deleteTemplate(alice.accessToken(), workspace.id(), created.id(), 0L)
                .andExpect(status().isNoContent());
    }

    // S-04 (часть)
    @Test
    void creatingATemplateInSomeoneElsesWorkspaceReturns404() throws Exception {
        RegisteredUser alice = testApi.register("alice6@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser mallory = testApi.register("mallory6@example.com", "Mallory");

        testApi.postTemplate(mallory.accessToken(), workspace.id(), new TemplateRequest("Hijack", null, List.of(), null))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
    }

    private TemplateEventRequest eventRequest(UUID id, DayOfWeek dayOfWeek, LocalTime time, UUID participant) {
        return new TemplateEventRequest(id, "Work", null, dayOfWeek, time, 240, Set.of(participant), EventCategory.WORK, null);
    }
}
