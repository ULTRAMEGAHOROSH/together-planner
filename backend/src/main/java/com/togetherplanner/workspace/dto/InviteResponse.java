package com.togetherplanner.workspace.dto;

import java.time.Instant;

/** {@code code} has no dash (stored and compared as-is); {@code displayCode} is for display only. */
public record InviteResponse(String code, String displayCode, Instant expiresAt) {
}
