package com.togetherplanner.workspace.service.impl;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.workspace.entity.Workspace;
import com.togetherplanner.workspace.entity.WorkspaceMember;
import com.togetherplanner.workspace.repository.WorkspaceMemberRepository;
import com.togetherplanner.workspace.repository.WorkspaceRepository;
import com.togetherplanner.workspace.service.WorkspaceAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Called by the event, template and schedule modules. Cross-module
 * methods don't check membership themselves - the calling public method
 * checks it exactly once, at the start of the use case.
 */
@Service
@RequiredArgsConstructor
public class WorkspaceAccessServiceImpl implements WorkspaceAccessService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Override
    public void requireMember(UUID wsId, UUID userId) {
        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(wsId, userId)) {
            // Someone else's workspace and a nonexistent one both get 404, never 403.
            throw new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found");
        }
    }

    @Override
    public ZoneId zoneOf(UUID wsId) {
        return workspaceRepository.findById(wsId)
                .map(Workspace::zoneId)
                .orElseThrow(() -> new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));
    }

    @Override
    public Set<UUID> memberIds(UUID wsId) {
        return workspaceMemberRepository.findByWorkspaceIdOrderBySeat(wsId).stream()
                .map(WorkspaceMember::getUserId)
                .collect(Collectors.toSet());
    }

    @Override
    public void lockForUpdate(UUID wsId) {
        workspaceRepository.findByIdForUpdate(wsId)
                .orElseThrow(() -> new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));
    }
}
