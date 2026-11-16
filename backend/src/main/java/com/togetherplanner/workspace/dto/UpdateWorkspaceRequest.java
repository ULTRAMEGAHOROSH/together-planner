package com.togetherplanner.workspace.dto;

import jakarta.validation.constraints.Size;

/** {@code null} в любом поле — не менять (spec §8.4). */
public record UpdateWorkspaceRequest(@Size(min = 1, max = 60) String name,
                                      @Size(max = 64) String timeZone) {
}
