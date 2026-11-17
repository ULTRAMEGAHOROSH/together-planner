package com.togetherplanner.workspace.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Workspace summary used across the API, including inside {@code MeResponse}. */
public record WorkspaceResponse(UUID id, String name, String timeZone,
                                 List<MemberResponse> members, Instant createdAt) {
}
