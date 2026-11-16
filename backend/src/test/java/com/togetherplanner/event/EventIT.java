package com.togetherplanner.event;

import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** spec §8.6 (E3–E6); roadmap 4.3. */
class EventIT extends AbstractIntegrationTest {

    private static final LocalDateTime START = LocalDateTime.of(2026, 11, 9, 9, 0);
    private static final LocalDateTime END = LocalDateTime.of(2026, 11, 9, 10, 0);

    @Test
    void createGetUpdateAndDeleteHappyPath() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        EventRequest createRequest = new EventRequest("Work", null, START, END,
                Set.of(alice.userId()), EventCategory.WORK, null, null);
        EventResponse created = testApi.createEvent(alice.accessToken(), workspace.id(), createRequest);
        assertThat(created.title()).isEqualTo("Work");
        assertThat(created.version()).isEqualTo(0L);
        assertThat(created.source()).isNull();
        assertThat(created.createdBy()).isEqualTo(alice.userId());

        EventResponse fetched = testApi.getEvent(alice.accessToken(), workspace.id(), created.id());
        assertThat(fetched.id()).isEqualTo(created.id());

        EventRequest updateRequest = new EventRequest("Renamed", "desc", START, END.plusHours(1),
                Set.of(alice.userId()), EventCategory.SPORT, null, created.version());
        testApi.putEvent(alice.accessToken(), workspace.id(), created.id(), updateRequest)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Renamed"))
                .andExpect(jsonPath("$.category").value("SPORT"))
                .andExpect(jsonPath("$.version").value(1));

        testApi.deleteEvent(alice.accessToken(), workspace.id(), created.id(), 1L)
                .andExpect(status().isNoContent());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + workspace.id() + "/events/" + created.id())
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isNotFound());
    }

    // I-06
    @Test
    void eventWithTwoParticipantsKeepsBothInTheResponse() throws Exception {
        RegisteredUser alice = testApi.register("alice2@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser bob = testApi.register("bob2@example.com", "Bob");
        testApi.join(bob.accessToken(), testApi.createInvite(alice.accessToken(), workspace.id()).code())
                .andExpect(status().isOk());

        EventRequest request = new EventRequest("Together", null, START, END,
                Set.of(alice.userId(), bob.userId()), EventCategory.TOGETHER, null, null);
        EventResponse created = testApi.createEvent(alice.accessToken(), workspace.id(), request);

        assertThat(created.participantIds()).containsExactlyInAnyOrder(alice.userId(), bob.userId());
    }

    // I-16
    @Test
    void secondPutWithStaleVersionGetsVersionConflict() throws Exception {
        RegisteredUser alice = testApi.register("alice3@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        EventResponse created = testApi.createEvent(alice.accessToken(), workspace.id(),
                new EventRequest("Work", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, null));

        EventRequest firstUpdate = new EventRequest("First", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, 0L);
        testApi.putEvent(alice.accessToken(), workspace.id(), created.id(), firstUpdate).andExpect(status().isOk());

        EventRequest secondUpdate = new EventRequest("Second", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, 0L);
        testApi.putEvent(alice.accessToken(), workspace.id(), created.id(), secondUpdate)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    // I-23
    @Test
    void deleteVersionCases() throws Exception {
        RegisteredUser alice = testApi.register("alice4@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        EventResponse created = testApi.createEvent(alice.accessToken(), workspace.id(),
                new EventRequest("Work", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, null));

        testApi.deleteEvent(alice.accessToken(), workspace.id(), created.id(), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));

        testApi.deleteEvent(alice.accessToken(), workspace.id(), created.id(), 99L)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));

        testApi.getEvent(alice.accessToken(), workspace.id(), created.id()); // ещё существует

        testApi.deleteEvent(alice.accessToken(), workspace.id(), created.id(), 0L)
                .andExpect(status().isNoContent());
    }

    // I-25
    @Test
    void dstGapShiftsStartForward() throws Exception {
        RegisteredUser alice = testApi.register("alice5@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Europe/Berlin");

        LocalDateTime gapStart = LocalDateTime.of(2026, 3, 29, 2, 30);
        LocalDateTime laterEnd = LocalDateTime.of(2026, 3, 29, 4, 30);
        EventResponse created = testApi.createEvent(alice.accessToken(), workspace.id(),
                new EventRequest("Spring forward", null, gapStart, laterEnd, Set.of(alice.userId()), EventCategory.WORK, null, null));

        assertThat(created.start()).isEqualTo(LocalDateTime.of(2026, 3, 29, 3, 30));
        assertThat(created.end()).isEqualTo(laterEnd);

        EventResponse reloaded = testApi.getEvent(alice.accessToken(), workspace.id(), created.id());
        assertThat(reloaded.start()).isEqualTo(LocalDateTime.of(2026, 3, 29, 3, 30));
    }

    // S-05
    @Test
    void foreignEventIdUnderOwnWorkspaceReturns404() throws Exception {
        RegisteredUser alice = testApi.register("alice6@example.com", "Alice");
        WorkspaceResponse workspaceA = testApi.createWorkspace(alice.accessToken(), "A", "Asia/Almaty");
        EventResponse eventInA = testApi.createEvent(alice.accessToken(), workspaceA.id(),
                new EventRequest("Work", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, null));

        RegisteredUser bob = testApi.register("bob6@example.com", "Bob");
        WorkspaceResponse workspaceB = testApi.createWorkspace(bob.accessToken(), "B", "Asia/Almaty");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + workspaceB.id() + "/events/" + eventInA.id())
                        .header("Authorization", "Bearer " + bob.accessToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
    }

    // S-06
    @Test
    void participantFromAnotherWorkspaceIsRejected() throws Exception {
        RegisteredUser alice = testApi.register("alice7@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser stranger = testApi.register("stranger7@example.com", "Stranger");
        testApi.createWorkspace(stranger.accessToken(), "Stranger's", "Asia/Almaty");

        EventRequest request = new EventRequest("Work", null, START, END,
                Set.of(alice.userId(), stranger.userId()), EventCategory.WORK, null, null);
        testApi.postEvent(alice.accessToken(), workspace.id(), request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EVENT_PARTICIPANT_NOT_MEMBER"));
    }

    // S-04 (часть): чужое пространство на E3 и E6
    @Test
    void creatingAnEventInSomeoneElsesWorkspaceReturns404() throws Exception {
        RegisteredUser alice = testApi.register("alice8@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser mallory = testApi.register("mallory8@example.com", "Mallory");

        testApi.postEvent(mallory.accessToken(), workspace.id(),
                        new EventRequest("Hijack", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, null))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
    }

    @Test
    void deletingAnEventInSomeoneElsesWorkspaceReturns404() throws Exception {
        RegisteredUser alice = testApi.register("alice9@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        EventResponse event = testApi.createEvent(alice.accessToken(), workspace.id(),
                new EventRequest("Work", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, null));
        RegisteredUser mallory = testApi.register("mallory9@example.com", "Mallory");

        testApi.deleteEvent(mallory.accessToken(), workspace.id(), event.id(), 0L)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKSPACE_NOT_FOUND"));
    }

    // C-04
    @Test
    void concurrentPutsWithTheSameVersionResultInExactlyOneWinner() throws Exception {
        RegisteredUser alice = testApi.register("alice10@example.com", "Alice");
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

    // C-06
    @Test
    void concurrentPutAndDeleteWithTheSameVersionResultInExactlyOneWinner() throws Exception {
        RegisteredUser alice = testApi.register("alice11@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        EventResponse created = testApi.createEvent(alice.accessToken(), workspace.id(),
                new EventRequest("Work", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, null));

        EventRequest update = new EventRequest("Updated", null, START, END, Set.of(alice.userId()), EventCategory.WORK, null, 0L);

        List<Integer> statuses = runConcurrently(
                () -> testApi.putEvent(alice.accessToken(), workspace.id(), created.id(), update).andReturn().getResponse().getStatus(),
                () -> testApi.deleteEvent(alice.accessToken(), workspace.id(), created.id(), 0L).andReturn().getResponse().getStatus());

        // Либо PUT выиграл (200) и DELETE получил 409/404, либо DELETE выиграл (204) и PUT получил 404/409.
        assertThat(statuses).anyMatch(s -> s == 200 || s == 204);
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
            return List.of(resultA.get(10, TimeUnit.SECONDS), resultB.get(10, TimeUnit.SECONDS));
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
}
