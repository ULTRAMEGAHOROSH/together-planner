package com.togetherplanner.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinWorkspaceRequest(@NotBlank @Size(max = 20) String code) {
}
