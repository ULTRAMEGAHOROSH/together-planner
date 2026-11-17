package com.togetherplanner.workspace;

import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.user.entity.User;
import com.togetherplanner.user.repository.UserRepository;
import com.togetherplanner.workspace.entity.Workspace;
import com.togetherplanner.workspace.entity.WorkspaceMember;
import com.togetherplanner.workspace.entity.WorkspaceRole;
import com.togetherplanner.workspace.repository.WorkspaceMemberRepository;
import com.togetherplanner.workspace.repository.WorkspaceRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** DB-level constraints on {@code workspace_member}. */
class WorkspaceMemberRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private WorkspaceRepository workspaceRepository;

    @Autowired
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void thirdInsertIntoSameWorkspaceSeatViolatesUniqueConstraint() {
        Workspace workspace = workspaceRepository.save(new Workspace("Our week", "Asia/Almaty", clock.instant()));
        User alice = userRepository.save(new User("alice@example.com", "Alice", "hash", clock.instant()));
        User bob = userRepository.save(new User("bob@example.com", "Bob", "hash", clock.instant()));
        User carol = userRepository.save(new User("carol@example.com", "Carol", "hash", clock.instant()));

        workspaceMemberRepository.save(new WorkspaceMember(workspace.getId(), alice.getId(), WorkspaceRole.OWNER, (short) 1, clock.instant()));
        workspaceMemberRepository.save(new WorkspaceMember(workspace.getId(), bob.getId(), WorkspaceRole.MEMBER, (short) 2, clock.instant()));

        WorkspaceMember third = new WorkspaceMember(workspace.getId(), carol.getId(), WorkspaceRole.MEMBER, (short) 1, clock.instant());
        assertThatThrownBy(() -> workspaceMemberRepository.saveAndFlush(third))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void secondWorkspaceForSameUserViolatesUniqueConstraint() {
        Workspace workspaceA = workspaceRepository.save(new Workspace("Workspace A", "Asia/Almaty", clock.instant()));
        Workspace workspaceB = workspaceRepository.save(new Workspace("Workspace B", "Asia/Almaty", clock.instant()));
        User alice = userRepository.save(new User("alice2@example.com", "Alice", "hash", clock.instant()));

        workspaceMemberRepository.save(new WorkspaceMember(workspaceA.getId(), alice.getId(), WorkspaceRole.OWNER, (short) 1, clock.instant()));

        WorkspaceMember secondMembership = new WorkspaceMember(workspaceB.getId(), alice.getId(), WorkspaceRole.OWNER, (short) 1, clock.instant());
        assertThatThrownBy(() -> workspaceMemberRepository.saveAndFlush(secondMembership))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
