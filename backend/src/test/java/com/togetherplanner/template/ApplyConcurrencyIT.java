package com.togetherplanner.template;

import com.togetherplanner.event.entity.EventCategory;
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
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * spec §14.4 (C-02). Без {@code @Transactional} на тестовом методе — оба
 * потока должны реально увидеть и закоммитить состояние друг друга, иначе
 * гонка (и блокировка workspace, которая её устраняет) не воспроизводится.
 * Войдёт в общий {@code ConcurrencyIT} на этапе 9 (roadmap 9.1) — пока
 * отдельным классом.
 */
class ApplyConcurrencyIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 11, 9);

    @Test
    void twoSimultaneousMergeApplicationsOfTheSameTemplateCreateExactlyFourEvents() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
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

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> applyTask = () -> {
                ready.countDown();
                start.await();
                return testApi.postApply(alice.accessToken(), workspace.id(), template.id(),
                                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null))
                        .andReturn().getResponse().getStatus();
            };

            Future<Integer> first = executor.submit(applyTask);
            Future<Integer> second = executor.submit(applyTask);

            ready.await();
            start.countDown();

            List<Integer> statuses = List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
            assertThat(statuses).containsExactly(200, 200);
        } finally {
            executor.shutdown();
        }

        List<com.togetherplanner.event.dto.EventResponse> events = testApi.listEvents(
                alice.accessToken(), workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        assertThat(events).hasSize(4);
    }
}
