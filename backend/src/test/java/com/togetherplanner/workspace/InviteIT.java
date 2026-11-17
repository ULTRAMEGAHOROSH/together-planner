package com.togetherplanner.workspace;

import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class InviteIT extends AbstractIntegrationTest {

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
    void thirdUserWithAFreshCodeGetsWorkspaceFull() throws Exception {
        RegisteredUser alice = testApi.register("alice2@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        InviteResponse firstInvite = testApi.createInvite(alice.accessToken(), workspace.id());
        RegisteredUser bob = testApi.register("bob2@example.com", "Bob");
        testApi.join(bob.accessToken(), firstInvite.code()).andExpect(status().isOk());

        InviteResponse secondInvite = testApi.createInvite(alice.accessToken(), workspace.id());
        RegisteredUser carol = testApi.register("carol2@example.com", "Carol");
        testApi.join(carol.accessToken(), secondInvite.code())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WORKSPACE_FULL"));
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
}
