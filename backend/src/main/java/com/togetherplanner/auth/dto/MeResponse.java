package com.togetherplanner.auth.dto;

import com.togetherplanner.user.dto.UserResponse;
import com.togetherplanner.workspace.dto.WorkspaceResponse;

/** {@code workspace == null} means the user hasn't created or joined one yet. */
public record MeResponse(UserResponse user, WorkspaceResponse workspace) {
}
