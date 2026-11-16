package com.togetherplanner.workspace;

import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import com.togetherplanner.workspace.entity.WorkspaceInvite;
import com.togetherplanner.workspace.repository.WorkspaceInviteRepository;
import com.togetherplanner.workspace.repository.WorkspaceMemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * spec §14.4 (C-01). Без {@code @Transactional} на тестовом методе: оба
 * потока должны реально увидеть и закоммитить состояние друг друга, иначе
 * гонка не воспроизводится. Войдёт в общий {@code ConcurrencyIT} на этапе 9
 * (roadmap 9.1) — пока отдельным классом.
 */
class InviteConcurrencyIT extends AbstractIntegrationTest {

    @Autowired
    private WorkspaceMemberRepository memberRepository;

    @Autowired
    private WorkspaceInviteRepository inviteRepository;

    @Test
    void twoUsersJoiningTheSameCodeSimultaneouslyResultInExactlyOneWinner() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        InviteResponse invite = testApi.createInvite(alice.accessToken(), workspace.id());

        RegisteredUser bob = testApi.register("bob@example.com", "Bob");
        RegisteredUser carol = testApi.register("carol@example.com", "Carol");

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> joinAsBob = joinTask(bob.accessToken(), invite.code(), ready, start);
            Callable<Integer> joinAsCarol = joinTask(carol.accessToken(), invite.code(), ready, start);

            Future<Integer> bobResult = executor.submit(joinAsBob);
            Future<Integer> carolResult = executor.submit(joinAsCarol);

            ready.await();
            start.countDown();

            List<Integer> statuses = List.of(bobResult.get(10, TimeUnit.SECONDS), carolResult.get(10, TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        } finally {
            executor.shutdown();
        }

        assertThat(memberRepository.countByWorkspaceId(workspace.id())).isEqualTo(2);
        WorkspaceInvite reloaded = inviteRepository.findByCode(invite.code()).orElseThrow();
        assertThat(reloaded.getUsedAt()).isNotNull();
    }

    private Callable<Integer> joinTask(String accessToken, String code, CountDownLatch ready, CountDownLatch start) {
        return () -> {
            ready.countDown();
            start.await();
            return testApi.join(accessToken, code).andReturn().getResponse().getStatus();
        };
    }
}
