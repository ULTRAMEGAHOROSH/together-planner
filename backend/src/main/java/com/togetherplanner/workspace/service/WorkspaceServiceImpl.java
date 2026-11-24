package com.togetherplanner.workspace.service;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.common.time.TimeRules;
import com.togetherplanner.workspace.dto.CreateWorkspaceRequest;
import com.togetherplanner.workspace.dto.MemberResponse;
import com.togetherplanner.workspace.dto.UpdateWorkspaceRequest;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import com.togetherplanner.workspace.entity.Workspace;
import com.togetherplanner.workspace.entity.WorkspaceMember;
import com.togetherplanner.workspace.entity.WorkspaceRole;
import com.togetherplanner.workspace.mapper.WorkspaceMapper;
import com.togetherplanner.workspace.repository.WorkspaceMemberRepository;
import com.togetherplanner.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** The creator becomes OWNER at seat 1. {@code findForUser} is also called from the auth module. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkspaceServiceImpl implements WorkspaceService {

    private static final short OWNER_SEAT = 1;

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceMapper workspaceMapper;
    private final Clock clock;

    @Override
    @Transactional
    public WorkspaceResponse create(UUID userId, CreateWorkspaceRequest request) {
        if (workspaceMemberRepository.existsByUserId(userId)) {
            // Fast path; uq_member_user is the last line of defense if two requests race.
            throw new ApiException(ErrorCode.ALREADY_IN_WORKSPACE, "User already belongs to a workspace");
        }
        requireValidTimeZone(request.timeZone());

        Instant now = clock.instant();
        Workspace workspace = workspaceRepository.save(new Workspace(request.name().trim(), request.timeZone(), now));
        WorkspaceMember owner = workspaceMemberRepository.save(
                new WorkspaceMember(workspace.getId(), userId, WorkspaceRole.OWNER, OWNER_SEAT, now));
        log.info("Workspace created: workspaceId={}, ownerId={}", workspace.getId(), userId);
        return workspaceMapper.toResponse(workspace, List.of(owner));
    }

    @Override
    public WorkspaceResponse current(UUID userId) {
        return findForUser(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "User has no workspace"));
    }

    @Override
    @Transactional
    public WorkspaceResponse update(UUID wsId, UpdateWorkspaceRequest request) {
        Workspace workspace = workspaceRepository.findById(wsId)
                .orElseThrow(() -> new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));

        if (request.name() != null) {
            workspace.setName(request.name().trim());
        }
        if (request.timeZone() != null) {
            requireValidTimeZone(request.timeZone());
            // Changing the time zone doesn't shift events - we don't touch a single event row here.
            workspace.setTimeZone(request.timeZone());
        }
        workspace.setUpdatedAt(clock.instant());

        List<WorkspaceMember> members = workspaceMemberRepository.findByWorkspaceIdOrderBySeat(wsId);
        return workspaceMapper.toResponse(workspace, members);
    }

    @Override
    public List<MemberResponse> members(UUID wsId) {
        return workspaceMapper.toMemberResponses(workspaceMemberRepository.findByWorkspaceIdOrderBySeat(wsId));
    }

    @Override
    public Optional<WorkspaceResponse> findForUser(UUID userId) {
        return workspaceMemberRepository.findByUserId(userId)
                .flatMap(member -> workspaceRepository.findById(member.getWorkspaceId())
                        .map(workspace -> workspaceMapper.toResponse(workspace,
                                workspaceMemberRepository.findByWorkspaceIdOrderBySeat(workspace.getId()))));
    }

    private void requireValidTimeZone(String timeZone) {
        if (!TimeRules.isValidRegionZone(timeZone)) {
            throw new ApiException(ErrorCode.INVALID_TIME_ZONE, "Not a valid IANA time zone id");
        }
    }
}
