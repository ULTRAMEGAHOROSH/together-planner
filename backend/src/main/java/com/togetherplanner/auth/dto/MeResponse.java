package com.togetherplanner.auth.dto;

import com.togetherplanner.user.dto.UserResponse;
import com.togetherplanner.workspace.dto.WorkspaceResponse;

/** {@code workspace == null} — у пользователя пока нет пространства; заполняется в этапе 3.2. */
public record MeResponse(UserResponse user, WorkspaceResponse workspace) {
}
