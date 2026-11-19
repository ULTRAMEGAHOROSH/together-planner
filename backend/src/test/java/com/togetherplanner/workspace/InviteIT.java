package com.togetherplanner.workspace;

import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.testsupport.TestClockConfig;
import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import com.togetherplanner.workspace.entity.WorkspaceInvite;
import com.togetherplanner.workspace.repository.WorkspaceInviteRepository;
import com.togetherplanner.workspace.repository.WorkspaceMemberRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class InviteIT extends AbstractIntegrationTest {

    @Autowired
    private WorkspaceInviteRepository inviteRepository;

    @Autowired
    private WorkspaceMemberRepository memberRepository;

    @Test
    void registerCreateWorkspaceInviteAndJoinEndsWithTwoMembersOnSeatsOneAndTwo() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/auth/me").header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workspace").value(org.hamcrest.Matchers.nullValue()));

        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        InviteResponse invite = testApi.createInvite(alice.accessToken(), workspace.id());

        RegisteredUser bob = testApi.register("bob@example.com", "Bob");
        testApi.join(bob.accessToken(), invite.code()).andExpect(status().isOk());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/v1/workspaces/" + workspace.id() + "/members")
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].seat").value(1))
                .andExpect(jsonPath("$[0].role").value("OWNER"))
                .andExpect(jsonPath("$[1].seat").value(2))
                .andExpect(jsonPath("$[1].role").value("MEMBER"));
    }

    @Test
    void inviteWithOneMemberIsCreatedForSevenDaysAndReplacesTheUnusedCode() throws Exception {
        RegisteredUser alice = testApi.register("alice2@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");

        InviteResponse first = testApi.createInvite(alice.accessToken(), workspace.id());
        assertThat(first.code()).matches("[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}");
        assertThat(first.displayCode()).isEqualTo(first.code().substring(0, 4) + "-" + first.code().substring(4));
        assertThat(first.expiresAt()).isEqualTo(TestClockConfig.TEST_START_INSTANT.plus(Duration.ofDays(7)));

        InviteResponse second = testApi.createInvite(alice.accessToken(), workspace.id());
        assertThat(inviteRepository.findByCode(first.code())).isEmpty();
        assertThat(invitesOf(workspace.id())).containsExactly(second.code() + " unused");
    }

    @Test
    void inviteInAFullWorkspaceIsRejectedWithWorkspaceFullForBothMembers() throws Exception {
        RegisteredUser alice = testApi.register("alice6@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        RegisteredUser bob = joinPartner(alice, workspace, "bob6@example.com");

        for (RegisteredUser member : List.of(alice, bob)) {
            postInvite(member, workspace.id())
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.code").value("WORKSPACE_FULL"));
        }
        assertThat(memberRepository.countByWorkspaceId(workspace.id())).isEqualTo(2);
    }

    @Test
    void rejectedInviteInAFullWorkspaceLeavesItsInvitesUntouched() throws Exception {
        RegisteredUser alice = testApi.register("alice7@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        joinPartner(alice, workspace, "bob7@example.com");
        String leftover = leftoverInvite(workspace.id(), alice.userId(), "XTRA7AAA");
        List<String> before = invitesOf(workspace.id());
        assertThat(before).hasSize(2).contains(leftover + " unused");

        postInvite(alice, workspace.id())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WORKSPACE_FULL"));

        assertThat(invitesOf(workspace.id())).isEqualTo(before);
    }

    /** I-02: the limit holds even for a code that is still unused and valid. */
    @Test
    void thirdUserCannotJoinAFullWorkspaceEvenWithAnUnusedCode() throws Exception {
        RegisteredUser alice = testApi.register("alice8@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        joinPartner(alice, workspace, "bob8@example.com");
        String leftover = leftoverInvite(workspace.id(), alice.userId(), "XTRA8AAA");

        RegisteredUser carol = testApi.register("carol8@example.com", "Carol");
        testApi.join(carol.accessToken(), leftover)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WORKSPACE_FULL"));

        assertThat(memberRepository.countByWorkspaceId(workspace.id())).isEqualTo(2);
        assertThat(memberRepository.existsByUserId(carol.userId())).isFalse();
        assertThat(inviteRepository.findByCode(leftover).orElseThrow().getUsedAt()).isNull();
    }

    @Test
    void reusingAnAlreadyUsedCodeIsRejected() throws Exception {
        RegisteredUser alice = testApi.register("alice3@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        InviteResponse invite = testApi.createInvite(alice.accessToken(), workspace.id());
        RegisteredUser bob = testApi.register("bob3@example.com", "Bob");
        testApi.join(bob.accessToken(), invite.code()).andExpect(status().isOk());

        RegisteredUser carol = testApi.register("carol3@example.com", "Carol");
        testApi.join(carol.accessToken(), invite.code())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVITE_ALREADY_USED"));
    }

    @Test
    void expiredInviteIsRejected() throws Exception {
        RegisteredUser alice = testApi.register("alice4@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        InviteResponse invite = testApi.createInvite(alice.accessToken(), workspace.id());

        clock.advance(Duration.ofDays(8));

        RegisteredUser bob = testApi.register("bob4@example.com", "Bob");
        testApi.join(bob.accessToken(), invite.code())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVITE_EXPIRED"));
    }

    @Test
    void normalizedCodeWithHyphenAndLowercaseStillWorks() throws Exception {
        RegisteredUser alice = testApi.register("alice5@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        InviteResponse invite = testApi.createInvite(alice.accessToken(), workspace.id());
        assertThat(invite.displayCode()).contains("-");

        RegisteredUser bob = testApi.register("bob5@example.com", "Bob");
        testApi.join(bob.accessToken(), invite.displayCode().toLowerCase()).andExpect(status().isOk());
    }

    private RegisteredUser joinPartner(RegisteredUser owner, WorkspaceResponse workspace, String email) throws Exception {
        InviteResponse invite = testApi.createInvite(owner.accessToken(), workspace.id());
        RegisteredUser partner = testApi.register(email, "Bob");
        testApi.join(partner.accessToken(), invite.code()).andExpect(status().isOk());
        return partner;
    }

    private ResultActions postInvite(RegisteredUser user, UUID wsId) throws Exception {
        return mockMvc.perform(post("/api/v1/workspaces/" + wsId + "/invites")
                .header("Authorization", "Bearer " + user.accessToken()));
    }

    /**
     * An unused, valid code in a full workspace. W5 no longer issues one, but a W5 that read
     * "one member" just before a concurrent join committed still can - the limit must hold anyway.
     */
    private String leftoverInvite(UUID wsId, UUID createdBy, String code) {
        Instant now = clock.instant();
        inviteRepository.saveAndFlush(new WorkspaceInvite(wsId, code, createdBy, now, now.plus(Duration.ofDays(7))));
        return code;
    }

    /** "CODE used" / "CODE unused" for every invite of the workspace, sorted by code. */
    private List<String> invitesOf(UUID wsId) {
        return inviteRepository.findAll().stream()
                .filter(invite -> invite.getWorkspaceId().equals(wsId))
                .map(invite -> invite.getCode() + (invite.getUsedAt() == null ? " unused" : " used"))
                .sorted()
                .toList();
    }
}
