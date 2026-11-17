package com.togetherplanner.security;

import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.template.dto.ApplyTemplateRequest;
import com.togetherplanner.template.dto.TemplateEventRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.template.entity.ApplyMode;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Parameterized over every member endpoint under {@code /workspaces/{wsId}}.
 * W1, W2 and W6 don't take someone else's {@code wsId} in the path, so
 * they're not included here.
 */
class ForeignWorkspaceAccessIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 11, 9);

    @Autowired
    private JsonMapper jsonMapper;

    @TestFactory
    List<DynamicTest> everyMemberEndpointRejectsANonMemberWith404() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser mallory = testApi.register("mallory@example.com", "Mallory");

        EventResponse event = testApi.createEvent(alice.accessToken(), workspace.id(), new EventRequest(
                "Work", null, LocalDateTime.of(2026, 11, 9, 9, 0), LocalDateTime.of(2026, 11, 9, 10, 0),
                Set.of(alice.userId()), EventCategory.WORK, null, null));
        TemplateResponse template = testApi.createTemplate(alice.accessToken(), workspace.id(), new TemplateRequest(
                "Usual week", null, List.of(new TemplateEventRequest(null, "t1", null, DayOfWeek.MONDAY,
                        LocalTime.of(9, 0), 240, Set.of(alice.userId()), EventCategory.WORK, null)), null));

        String token = mallory.accessToken();
        String wsId = workspace.id().toString();
        String eventId = event.id().toString();
        String templateId = template.id().toString();

        List<NamedCase> cases = List.of(
                new NamedCase("W3 patch workspace", () -> mockMvc.perform(auth(patch("/api/v1/workspaces/" + wsId), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Hijack\"}"))),
                new NamedCase("W4 members", () -> mockMvc.perform(auth(get("/api/v1/workspaces/" + wsId + "/members"), token))),
                new NamedCase("W5 create invite", () -> mockMvc.perform(auth(post("/api/v1/workspaces/" + wsId + "/invites"), token))),
                new NamedCase("S1 week", () -> mockMvc.perform(auth(get("/api/v1/workspaces/" + wsId + "/week"), token))),
                new NamedCase("E1 range", () -> mockMvc.perform(auth(get("/api/v1/workspaces/" + wsId + "/events")
                        .param("from", "2026-11-09").param("to", "2026-11-15"), token))),
                new NamedCase("E2 upcoming", () -> mockMvc.perform(auth(get("/api/v1/workspaces/" + wsId + "/events/upcoming"), token))),
                new NamedCase("E3 create", () -> mockMvc.perform(auth(post("/api/v1/workspaces/" + wsId + "/events"), token)
                        .contentType(MediaType.APPLICATION_JSON).content(jsonMapper.writeValueAsString(new EventRequest(
                                "Hijack", null, LocalDateTime.of(2026, 11, 9, 9, 0), LocalDateTime.of(2026, 11, 9, 10, 0),
                                Set.of(mallory.userId()), EventCategory.WORK, null, null))))),
                new NamedCase("E4 get", () -> mockMvc.perform(auth(get("/api/v1/workspaces/" + wsId + "/events/" + eventId), token))),
                new NamedCase("E5 update", () -> mockMvc.perform(auth(put("/api/v1/workspaces/" + wsId + "/events/" + eventId), token)
                        .contentType(MediaType.APPLICATION_JSON).content(jsonMapper.writeValueAsString(new EventRequest(
                                "Hijack", null, LocalDateTime.of(2026, 11, 9, 9, 0), LocalDateTime.of(2026, 11, 9, 10, 0),
                                Set.of(mallory.userId()), EventCategory.WORK, null, 0L))))),
                new NamedCase("E6 delete", () -> mockMvc.perform(auth(delete("/api/v1/workspaces/" + wsId + "/events/" + eventId)
                        .param("version", "0"), token))),
                new NamedCase("T1 list", () -> mockMvc.perform(auth(get("/api/v1/workspaces/" + wsId + "/templates"), token))),
                new NamedCase("T2 create", () -> mockMvc.perform(auth(post("/api/v1/workspaces/" + wsId + "/templates"), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonMapper.writeValueAsString(new TemplateRequest("Hijack", null, List.of(), null))))),
                new NamedCase("T3 get", () -> mockMvc.perform(auth(get("/api/v1/workspaces/" + wsId + "/templates/" + templateId), token))),
                new NamedCase("T4 update", () -> mockMvc.perform(auth(put("/api/v1/workspaces/" + wsId + "/templates/" + templateId), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonMapper.writeValueAsString(new TemplateRequest("Hijack", null, List.of(), 0L))))),
                new NamedCase("T5 delete", () -> mockMvc.perform(auth(delete("/api/v1/workspaces/" + wsId + "/templates/" + templateId)
                        .param("version", "0"), token))),
                new NamedCase("T6 apply preview", () -> mockMvc.perform(
                        auth(post("/api/v1/workspaces/" + wsId + "/templates/" + templateId + "/apply/preview"), token)
                                .contentType(MediaType.APPLICATION_JSON).content(jsonMapper.writeValueAsString(
                                        new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null))))),
                new NamedCase("T7 apply", () -> mockMvc.perform(
                        auth(post("/api/v1/workspaces/" + wsId + "/templates/" + templateId + "/apply"), token)
                                .contentType(MediaType.APPLICATION_JSON).content(jsonMapper.writeValueAsString(
                                        new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null))))),
                new NamedCase("T8 application history", () -> mockMvc.perform(
                        auth(get("/api/v1/workspaces/" + wsId + "/template-applications"), token)))
        );

        return cases.stream()
                .map(c -> DynamicTest.dynamicTest(c.name(), () -> {
                    ResultActions result = c.action().perform();
                    result.andExpect(status().isNotFound())
                            .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
                }))
                .toList();
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder auth(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder, String accessToken) {
        return builder.header("Authorization", "Bearer " + accessToken);
    }

    private record NamedCase(String name, Action action) {
    }

    @FunctionalInterface
    private interface Action {
        ResultActions perform() throws Exception;
    }
}
