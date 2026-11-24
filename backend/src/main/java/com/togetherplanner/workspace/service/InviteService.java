package com.togetherplanner.workspace.service;

import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.JoinWorkspaceRequest;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import java.util.UUID;

/** Invite codes: creating them and joining a workspace by code. */
public interface InviteService {

    /**
     * W5. A full workspace gets {@code 409 WORKSPACE_FULL} and its invites stay untouched (D-10).
     * Otherwise any unused codes are cleared before the new one is issued.
     */
    InviteResponse createInvite(UUID wsId, UUID createdBy);

    /** Joins a workspace by invite code. The checks above are the fast path; the conditional update plus unique indexes are what actually close the race. */
    WorkspaceResponse join(UUID userId, JoinWorkspaceRequest request);
}
