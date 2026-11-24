package com.togetherplanner.workspace.service.impl;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.JoinWorkspaceRequest;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import com.togetherplanner.workspace.entity.Workspace;
import com.togetherplanner.workspace.entity.WorkspaceInvite;
import com.togetherplanner.workspace.entity.WorkspaceMember;
import com.togetherplanner.workspace.entity.WorkspaceRole;
import com.togetherplanner.workspace.mapper.WorkspaceMapper;
import com.togetherplanner.workspace.repository.WorkspaceInviteRepository;
import com.togetherplanner.workspace.repository.WorkspaceMemberRepository;
import com.togetherplanner.workspace.repository.WorkspaceRepository;
import com.togetherplanner.workspace.service.InviteCodeGenerator;
import com.togetherplanner.workspace.service.InviteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Creates invite codes and handles joining a workspace by code - no pessimistic locking needed here. */
@Slf4j
@Service
@RequiredArgsConstructor
public class InviteServiceImpl implements InviteService {

    private static final Duration INVITE_TTL = Duration.ofDays(7);
    private static final int MAX_MEMBERS = 2;
    private static final short JOINING_MEMBER_SEAT = 2;

    private final WorkspaceInviteRepository inviteRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMapper workspaceMapper;
    private final InviteCodeGenerator codeGenerator;
    private final Clock clock;

    @Override
    @Transactional
    public InviteResponse createInvite(UUID wsId, UUID createdBy) {
        if (memberRepository.countByWorkspaceId(wsId) >= MAX_MEMBERS) {
            throw new ApiException(ErrorCode.WORKSPACE_FULL, "Workspace already has two members");
        }
        inviteRepository.deleteUnusedByWorkspaceId(wsId);

        String code;
        do {
            code = codeGenerator.generate();
        } while (inviteRepository.existsByCode(code));   // check before inserting, not catch-and-retry on a constraint

        Instant now = clock.instant();
        Instant expiresAt = now.plus(INVITE_TTL);
        inviteRepository.save(new WorkspaceInvite(wsId, code, createdBy, now, expiresAt));
        return new InviteResponse(code, InviteCodeGenerator.toDisplayCode(code), expiresAt);
    }

    @Override
    @Transactional
    public WorkspaceResponse join(UUID userId, JoinWorkspaceRequest request) {
        String code = InviteCodeGenerator.normalize(request.code());
        WorkspaceInvite invite = inviteRepository.findByCode(code)
                .orElseThrow(() -> new ApiException(ErrorCode.INVITE_NOT_FOUND, "Invite not found"));

        if (memberRepository.existsByUserId(userId)) {
            throw new ApiException(ErrorCode.ALREADY_IN_WORKSPACE, "User already belongs to a workspace");
        }

        Instant now = clock.instant();
        if (invite.getUsedAt() != null) {
            throw new ApiException(ErrorCode.INVITE_ALREADY_USED, "Invite has already been used");
        }
        if (!invite.getExpiresAt().isAfter(now)) {
            throw new ApiException(ErrorCode.INVITE_EXPIRED, "Invite has expired");
        }
        if (memberRepository.countByWorkspaceId(invite.getWorkspaceId()) >= MAX_MEMBERS) {
            throw new ApiException(ErrorCode.WORKSPACE_FULL, "Workspace already has two members");
        }

        int updated = inviteRepository.markUsed(invite.getId(), userId, now);
        if (updated == 0) {
            // A concurrent join with the same code won the race.
            throw new ApiException(ErrorCode.INVITE_ALREADY_USED, "Invite has already been used");
        }

        // saveAndFlush so a uq_member_workspace_seat/uq_member_user violation
        // surfaces right here, inside this transaction, rolling back markUsed
        // along with this insert.
        memberRepository.saveAndFlush(
                new WorkspaceMember(invite.getWorkspaceId(), userId, WorkspaceRole.MEMBER, JOINING_MEMBER_SEAT, now));

        Workspace workspace = workspaceRepository.findById(invite.getWorkspaceId())
                .orElseThrow(() -> new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));
        List<WorkspaceMember> members = memberRepository.findByWorkspaceIdOrderBySeat(workspace.getId());
        log.info("User joined workspace: workspaceId={}, userId={}", workspace.getId(), userId);
        return workspaceMapper.toResponse(workspace, members);
    }
}
