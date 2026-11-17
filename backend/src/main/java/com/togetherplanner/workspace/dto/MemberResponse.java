package com.togetherplanner.workspace.dto;

import com.togetherplanner.workspace.entity.WorkspaceRole;

import java.time.Instant;
import java.util.UUID;

/** The member list is always ordered by {@code seat}. */
public record MemberResponse(UUID userId, String displayName, WorkspaceRole role, int seat, Instant joinedAt) {
}
