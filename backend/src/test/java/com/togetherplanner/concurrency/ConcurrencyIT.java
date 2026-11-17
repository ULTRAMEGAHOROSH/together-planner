package com.togetherplanner.concurrency;

import com.jayway.jsonpath.JsonPath;
import com.togetherplanner.auth.repository.RefreshTokenRepository;
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
import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import com.togetherplanner.workspace.repository.WorkspaceInviteRepository;
import com.togetherplanner.workspace.repository.WorkspaceMemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * One class for every concurrency test. No {@code @Transactional} on any
 * method: both threads need to actually see and commit each other's
 * state, or the race (and the defense against it) never reproduces.
 */
class ConcurrencyIT extends AbstractIntegrationTest {

    private static final Pattern COOKIE_VALUE = Pattern.compile("tp_refresh=([^;]*)");
    private static final LocalDateTime START = LocalDateTime.of(2026, 11, 9, 9, 0);
    private static final LocalDateTime END = LocalDateTime.of(2026, 11, 9, 10, 0);
    private static final LocalDate WEEK_START = LocalDate.of(2026, 11, 9);

    @Autowired
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Autowired
    private WorkspaceInviteRepository workspaceInviteRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Test
    void twoUsersJoiningTheSameCodeSimultaneouslyResultInExactlyOneWinner() throws Exception {
        RegisteredUser alice = testApi.register("alice-c1@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        InviteResponse invite = testApi.createInvite(alice.accessToken(), workspace.id());
        RegisteredUser bob = testApi.register("bob-c1@example.com", "Bob");
        RegisteredUser carol = testApi.register("carol-c1@example.com", "Carol");

        List<Integer> statuses = runConcurrently(
                () -> testApi.join(bob.accessToken(), invite.code()).andReturn().getResponse().getStatus(),
                () -> testApi.join(carol.accessToken(), invite.code()).andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(workspaceMemberRepository.countByWorkspaceId(workspace.id())).isEqualTo(2);
        assertThat(workspaceInviteRepository.findByCode(invite.code()).orElseThrow().getUsedAt()).isNotNull();
    }

    @Test
    void twoSimultaneousMergeApplicationsOfTheSameTemplateCreateExactlyFourEvents() throws Exception {
        RegisteredUser alice = testApi.register("alice-c2@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        TemplateResponse template = testApi.createTemplate(alice.accessToken(), workspace.id(), new TemplateRequest(
                "Usual week", null, List.of(
                        new TemplateEventRequest(null, "t1", null, DayOfWeek.MONDAY, LocalTime.of(9, 0), 240,
                                Set.of(alice.userId()), EventCategory.WORK, null),
                        new TemplateEventRequest(null, "t2", null, DayOfWeek.TUESDAY, LocalTime.of(9, 0), 240,
                                Set.of(alice.userId()), EventCategory.WORK, null),
                        new TemplateEventRequest(null, "t3", null, DayOfWeek.WEDNESDAY, LocalTime.of(9, 0), 240,
                                Set.of(alice.userId()), EventCategory.WORK, null),
                        new TemplateEventRequest(null, "t4", null, DayOfWeek.THURSDAY, LocalTime.of(9, 0), 240,
                                Set.of(alice.userId()), EventCategory.WORK, null)
                ), null));

        List<Integer> statuses = runConcurrently(
                () -> testApi.postApply(alice.accessToken(), workspace.id(), template.id(),
                                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null))
                        .andReturn().getResponse().getStatus(),
                () -> testApi.postApply(alice.accessToken(), workspace.id(), template.id(),
                                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null))
                        .andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactly(200, 200);
        assertThat(testApi.listEvents(alice.accessToken(), workspace.id(), WEEK_START, WEEK_START.plusDays(6))).hasSize(4);
    }

    @Test
    void twoSimultaneousRefreshesWithTheSameCookieHaveExactlyOneWinnerAndNoMassRevoke() throws Exception {
        MvcResult registerResult = mockMvc.perform(authPost("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice-c3@example.com\",\"password\":\"password1\",\"displayName\":\"Alice\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String cookie = extractCookieValue(registerResult);

        List<Integer> statuses = runConcurrently(
                () -> mockMvc.perform(authPost("/api/v1/auth/refresh").cookie(cookieOf(cookie))).andReturn().getResponse().getStatus(),
                () -> mockMvc.perform(authPost("/api/v1/auth/refresh").cookie(cookieOf(cookie))).andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactlyInAnyOrder(200, 401);

        // Exactly one active (non-revoked) token - the winner's; no mass revoke (REUSE_DETECTED).
        long activeCount = refreshTokenRepository.findAll().stream()
                .filter(t -> t.getRevokedAt() == null)
                .count();
        assertThat(activeCount).isEqualTo(1);
        boolean massRevoked = refreshTokenRepository.findAll().stream()
                .anyMatch(t -> t.getRevokeReason() == com.togetherplanner.auth.entity.RevokeReason.REUSE_DETECTED);
        assertThat(massRevoked).isFalse();
    }

    @Test
    void concurrentPutsWithTheSameVersionResultInExactlyOneWinner() throws Exception {
        RegisteredUser alice = testApi.register("alice-c4@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        EventResponse created = testApi.createEvent(alice.accessToken(), workspace.id(),
                new EventRequest("Work", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, null));

        EventRequest updateA = new EventRequest("A", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, 0L);
        EventRequest updateB = new EventRequest("B", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, 0L);

        List<Integer> statuses = runConcurrently(
                () -> testApi.putEvent(alice.accessToken(), workspace.id(), created.id(), updateA).andReturn().getResponse().getStatus(),
                () -> testApi.putEvent(alice.accessToken(), workspace.id(), created.id(), updateB).andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
    }

    @Test
    void twoSimultaneousRegistrationsWithTheSameEmailHaveExactlyOneWinner() throws Exception {
        String body = "{\"email\":\"carol-c5@example.com\",\"password\":\"password1\",\"displayName\":\"Carol\"}";

        List<Integer> statuses = runConcurrently(
                () -> mockMvc.perform(authPost("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                        .andReturn().getResponse().getStatus(),
                () -> mockMvc.perform(authPost("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                        .andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactlyInAnyOrder(201, 409);

        MvcResult failing = mockMvc.perform(authPost("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andReturn();
        String code = JsonPath.read(failing.getResponse().getContentAsString(), "$.code");
        assertThat(code).isEqualTo("EMAIL_ALREADY_REGISTERED"); // not DATA_CONFLICT
    }

    @Test
    void concurrentPutAndDeleteWithTheSameVersionResultInExactlyOneWinner() throws Exception {
        RegisteredUser alice = testApi.register("alice-c6@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        EventResponse created = testApi.createEvent(alice.accessToken(), workspace.id(),
                new EventRequest("Work", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, null));

        EventRequest update = new EventRequest("Updated", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, 0L);

        List<Integer> statuses = runConcurrently(
                () -> testApi.putEvent(alice.accessToken(), workspace.id(), created.id(), update).andReturn().getResponse().getStatus(),
                () -> testApi.deleteEvent(alice.accessToken(), workspace.id(), created.id(), 0L).andReturn().getResponse().getStatus());

        // Either PUT won (200) and DELETE got 409/404, or DELETE won (204) and PUT got 404/409.
        assertThat(statuses).allMatch(s -> List.of(200, 204, 404, 409).contains(s));
        long successCount = statuses.stream().filter(s -> s == 200 || s == 204).count();
        assertThat(successCount).isEqualTo(1);
    }

    private List<Integer> runConcurrently(Callable<Integer> taskA, Callable<Integer> taskB) throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> resultA = executor.submit(withGate(taskA, ready, start));
            Future<Integer> resultB = executor.submit(withGate(taskB, ready, start));
            ready.await();
            start.countDown();
            return List.of(resultA.get(15, TimeUnit.SECONDS), resultB.get(15, TimeUnit.SECONDS));
        } finally {
            executor.shutdown();
        }
    }

    private Callable<Integer> withGate(Callable<Integer> task, CountDownLatch ready, CountDownLatch start) {
        return () -> {
            ready.countDown();
            start.await();
            return task.call();
        };
    }

    private MockHttpServletRequestBuilder authPost(String url) {
        return post(url).header("X-Requested-With", "XMLHttpRequest");
    }

    private jakarta.servlet.http.Cookie cookieOf(String value) {
        return new jakarta.servlet.http.Cookie("tp_refresh", value);
    }

    private String extractCookieValue(MvcResult result) {
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        Matcher matcher = COOKIE_VALUE.matcher(setCookie);
        assertThat(matcher.find()).as("Set-Cookie header contains tp_refresh").isTrue();
        return matcher.group(1);
    }
}
