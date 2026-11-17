package com.togetherplanner.testsupport;

import com.jayway.jsonpath.JsonPath;
import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.template.dto.ApplyPreviewResponse;
import com.togetherplanner.template.dto.ApplyResultResponse;
import com.togetherplanner.template.dto.ApplyTemplateRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Помощник для IT-тестов (spec §14.1): register/login/createWorkspace/createInvite/join,
 * возвращающие токены и id, вместо повторения HTTP-деталей в каждом тесте.
 */
@Component
public class TestApi {

    private static final String DEFAULT_PASSWORD = "password1";
    private static final Pattern COOKIE_VALUE = Pattern.compile("tp_refresh=([^;]*)");

    private final MockMvc mockMvc;
    private final JsonMapper jsonMapper;

    public TestApi(MockMvc mockMvc, JsonMapper jsonMapper) {
        this.mockMvc = mockMvc;
        this.jsonMapper = jsonMapper;
    }

    public RegisteredUser register(String email, String displayName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .header("X-Requested-With", "XMLHttpRequest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\",\"displayName\":\"%s\"}"
                                .formatted(email, DEFAULT_PASSWORD, displayName)))
                .andExpect(status().isCreated())
                .andReturn();
        return toRegisteredUser(result);
    }

    public RegisteredUser login(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Requested-With", "XMLHttpRequest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, DEFAULT_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        return toRegisteredUser(result);
    }

    public WorkspaceResponse createWorkspace(String accessToken, String name, String timeZone) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/workspaces")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"%s\",\"timeZone\":\"%s\"}".formatted(name, timeZone)))
                .andExpect(status().isCreated())
                .andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(), WorkspaceResponse.class);
    }

    public InviteResponse createInvite(String accessToken, UUID wsId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/workspaces/" + wsId + "/invites")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isCreated())
                .andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(), InviteResponse.class);
    }

    /** Результат не проверяется здесь — тесты сами задают ожидания (200 или конкретная ошибка). */
    public ResultActions join(String accessToken, String code) throws Exception {
        return mockMvc.perform(post("/api/v1/workspaces/join")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"%s\"}".formatted(code)));
    }

    public ResultActions postEvent(String accessToken, UUID wsId, EventRequest request) throws Exception {
        return mockMvc.perform(post("/api/v1/workspaces/" + wsId + "/events")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    public EventResponse createEvent(String accessToken, UUID wsId, EventRequest request) throws Exception {
        MvcResult result = postEvent(accessToken, wsId, request).andExpect(status().isCreated()).andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(), EventResponse.class);
    }

    public ResultActions putEvent(String accessToken, UUID wsId, UUID eventId, EventRequest request) throws Exception {
        return mockMvc.perform(put("/api/v1/workspaces/" + wsId + "/events/" + eventId)
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    public ResultActions deleteEvent(String accessToken, UUID wsId, UUID eventId, Long version) throws Exception {
        String url = "/api/v1/workspaces/" + wsId + "/events/" + eventId + (version != null ? "?version=" + version : "");
        return mockMvc.perform(delete(url).header("Authorization", "Bearer " + accessToken));
    }

    public EventResponse getEvent(String accessToken, UUID wsId, UUID eventId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/workspaces/" + wsId + "/events/" + eventId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(), EventResponse.class);
    }

    public ResultActions postTemplate(String accessToken, UUID wsId, TemplateRequest request) throws Exception {
        return mockMvc.perform(post("/api/v1/workspaces/" + wsId + "/templates")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    public TemplateResponse createTemplate(String accessToken, UUID wsId, TemplateRequest request) throws Exception {
        MvcResult result = postTemplate(accessToken, wsId, request).andExpect(status().isCreated()).andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(), TemplateResponse.class);
    }

    public ResultActions putTemplate(String accessToken, UUID wsId, UUID templateId, TemplateRequest request) throws Exception {
        return mockMvc.perform(put("/api/v1/workspaces/" + wsId + "/templates/" + templateId)
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    public ResultActions deleteTemplate(String accessToken, UUID wsId, UUID templateId, Long version) throws Exception {
        String url = "/api/v1/workspaces/" + wsId + "/templates/" + templateId + (version != null ? "?version=" + version : "");
        return mockMvc.perform(delete(url).header("Authorization", "Bearer " + accessToken));
    }

    public TemplateResponse getTemplate(String accessToken, UUID wsId, UUID templateId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/workspaces/" + wsId + "/templates/" + templateId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(), TemplateResponse.class);
    }

    public List<EventResponse> listEvents(String accessToken, UUID wsId, LocalDate from, LocalDate to) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/workspaces/" + wsId + "/events")
                        .param("from", from.toString())
                        .param("to", to.toString())
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(),
                jsonMapper.getTypeFactory().constructCollectionType(List.class, EventResponse.class));
    }

    public ResultActions postApplyPreview(String accessToken, UUID wsId, UUID templateId, ApplyTemplateRequest request) throws Exception {
        return mockMvc.perform(post("/api/v1/workspaces/" + wsId + "/templates/" + templateId + "/apply/preview")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    public ApplyPreviewResponse previewApply(String accessToken, UUID wsId, UUID templateId, ApplyTemplateRequest request) throws Exception {
        MvcResult result = postApplyPreview(accessToken, wsId, templateId, request).andExpect(status().isOk()).andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(), ApplyPreviewResponse.class);
    }

    public ResultActions postApply(String accessToken, UUID wsId, UUID templateId, ApplyTemplateRequest request) throws Exception {
        return mockMvc.perform(post("/api/v1/workspaces/" + wsId + "/templates/" + templateId + "/apply")
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    public ApplyResultResponse applyTemplate(String accessToken, UUID wsId, UUID templateId, ApplyTemplateRequest request) throws Exception {
        MvcResult result = postApply(accessToken, wsId, templateId, request).andExpect(status().isOk()).andReturn();
        return jsonMapper.readValue(result.getResponse().getContentAsString(), ApplyResultResponse.class);
    }

    private RegisteredUser toRegisteredUser(MvcResult result) throws java.io.UnsupportedEncodingException {
        String body = result.getResponse().getContentAsString();
        String accessToken = JsonPath.read(body, "$.accessToken");
        String userId = JsonPath.read(body, "$.user.id");
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        Matcher matcher = COOKIE_VALUE.matcher(setCookie == null ? "" : setCookie);
        String refreshCookie = matcher.find() ? matcher.group(1) : null;
        return new RegisteredUser(UUID.fromString(userId), accessToken, refreshCookie);
    }
}
