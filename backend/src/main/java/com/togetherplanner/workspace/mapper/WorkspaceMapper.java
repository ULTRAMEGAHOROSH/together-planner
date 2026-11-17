package com.togetherplanner.workspace.mapper;

import com.togetherplanner.user.service.UserService;
import com.togetherplanner.workspace.dto.MemberResponse;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import com.togetherplanner.workspace.entity.Workspace;
import com.togetherplanner.workspace.entity.WorkspaceMember;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Display names live in the user module, not workspace_member - fetched from there in bulk. */
@Component
@RequiredArgsConstructor
public class WorkspaceMapper {

    private final UserService userService;

    /** Expects {@code members} already sorted by {@code seat} (see {@code findByWorkspaceIdOrderBySeat}). */
    public WorkspaceResponse toResponse(Workspace workspace, List<WorkspaceMember> members) {
        return new WorkspaceResponse(workspace.getId(), workspace.getName(), workspace.getTimeZone(),
                toMemberResponses(members), workspace.getCreatedAt());
    }

    public List<MemberResponse> toMemberResponses(List<WorkspaceMember> members) {
        Map<UUID, String> displayNames = userService.displayNames(members.stream().map(WorkspaceMember::getUserId).toList());
        return members.stream()
                .map(m -> new MemberResponse(m.getUserId(), displayNames.get(m.getUserId()), m.getRole(), m.getSeat(), m.getJoinedAt()))
                .toList();
    }
}
