package com.togetherplanner.workspace;

import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WorkspaceIT extends AbstractIntegrationTest {

    @Test
    void createThenCurrentThenMeShowsTheWorkspace() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");

        WorkspaceResponse created = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        assertThat(created.name()).isEqualTo("Our week");
        assertThat(created.members()).hasSize(1);
        assertThat(created.members().get(0).seat()).isEqualTo(1);
        assertThat(created.members().get(0).role().name()).isEqualTo("OWNER");

        mockMvc.perform(get("/api/v1/workspaces/current").header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(created.id().toString()));

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workspace.id").value(created.id().toString()));
    }

    @Test
    void creatingASecondWorkspaceIsRejected() throws Exception {
        RegisteredUser alice = testApi.register("alice2@example.com", "Alice");
        testApi.createWorkspace(alice.accessToken(), "First", "Asia/Almaty");

        mockMvc.perform(post("/api/v1/workspaces")
                        .header("Authorization", "Bearer " + alice.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Second\",\"timeZone\":\"Asia/Almaty\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_IN_WORKSPACE"));
    }

    @Test
    void patchingWithAFixedOffsetTimeZoneIsRejected() throws Exception {
        RegisteredUser alice = testApi.register("alice3@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        mockMvc.perform(patch("/api/v1/workspaces/" + workspace.id())
                        .header("Authorization", "Bearer " + alice.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"timeZone\":\"+05:00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_TIME_ZONE"));
    }

    @Test
    void patchingTheNameKeepsItTrimmedAndDoesNotTouchTimeZone() throws Exception {
        RegisteredUser alice = testApi.register("alice4@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        mockMvc.perform(patch("/api/v1/workspaces/" + workspace.id())
                        .header("Authorization", "Bearer " + alice.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Renamed  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"))
                .andExpect(jsonPath("$.timeZone").value("Asia/Almaty"));
    }

    @Test
    void patchingSomeoneElsesWorkspaceReturns404() throws Exception {
        RegisteredUser alice = testApi.register("alice5@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Alice's", "Asia/Almaty");
        RegisteredUser mallory = testApi.register("mallory@example.com", "Mallory");

        mockMvc.perform(patch("/api/v1/workspaces/" + workspace.id())
                        .header("Authorization", "Bearer " + mallory.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Hijacked\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
    }

    @Test
    void listingMembersOfSomeoneElsesWorkspaceReturns404() throws Exception {
        RegisteredUser alice = testApi.register("alice6@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Alice's", "Asia/Almaty");
        RegisteredUser mallory = testApi.register("mallory2@example.com", "Mallory");

        mockMvc.perform(get("/api/v1/workspaces/" + workspace.id() + "/members")
                        .header("Authorization", "Bearer " + mallory.accessToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
    }
}
