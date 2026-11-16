package com.togetherplanner.workspace.dto;

import java.time.Instant;

/** spec §8.4. {@code code} — без дефиса (хранится и сравнивается), {@code displayCode} — только для показа. */
public record InviteResponse(String code, String displayCode, Instant expiresAt) {
}
