package com.togetherplanner.workspace.dto;

import jakarta.validation.constraints.Size;

/** {@code null} on any field means leave it unchanged. */
public record UpdateWorkspaceRequest(@Size(min = 1, max = 60) String name,
                                      @Size(max = 64) String timeZone) {
}
