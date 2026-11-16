package com.togetherplanner.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateWorkspaceRequest(@NotBlank @Size(max = 60) String name,
                                      @NotBlank @Size(max = 64) String timeZone) {
}
