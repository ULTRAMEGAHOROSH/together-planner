package com.togetherplanner.workspace.dto;

import com.togetherplanner.workspace.entity.WorkspaceRole;

import java.time.Instant;
import java.util.UUID;

/** spec §8.2. Список участников — всегда по {@code seat} (spec §6.4, A-29). */
public record MemberResponse(UUID userId, String displayName, WorkspaceRole role, int seat, Instant joinedAt) {
}
