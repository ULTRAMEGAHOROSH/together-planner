package com.togetherplanner.workspace.service;

import com.togetherplanner.workspace.dto.CreateWorkspaceRequest;
import com.togetherplanner.workspace.dto.MemberResponse;
import com.togetherplanner.workspace.dto.UpdateWorkspaceRequest;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceService {

    WorkspaceResponse create(UUID userId, CreateWorkspaceRequest request);

    WorkspaceResponse current(UUID userId);

    WorkspaceResponse update(UUID wsId, UpdateWorkspaceRequest request);

    List<MemberResponse> members(UUID wsId);

    Optional<WorkspaceResponse> findForUser(UUID userId);
}
