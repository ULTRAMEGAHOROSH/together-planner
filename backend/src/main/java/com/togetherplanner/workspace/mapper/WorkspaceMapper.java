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

/** Имя участника в {@code user}, не в {@code workspace_member} — список имён запрашивается оттуда (spec §6.4). */
@Component
@RequiredArgsConstructor
public class WorkspaceMapper {

    private final UserService userService;

    /** {@code members} должен уже быть отсортирован по {@code seat} (см. {@code findByWorkspaceIdOrderBySeat}). */
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
