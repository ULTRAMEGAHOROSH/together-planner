package com.togetherplanner.workspace.service;

import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.JoinWorkspaceRequest;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import java.util.UUID;

public interface InviteService {

    InviteResponse createInvite(UUID wsId, UUID createdBy);

    WorkspaceResponse join(UUID userId, JoinWorkspaceRequest request);
}
