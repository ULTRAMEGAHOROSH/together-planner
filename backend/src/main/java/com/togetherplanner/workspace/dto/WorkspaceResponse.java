package com.togetherplanner.workspace.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** spec §8.4. Полная реализация (W1–W6) — этап 3; здесь только тип, нужный для {@code MeResponse} (этап 2.3). */
public record WorkspaceResponse(UUID id, String name, String timeZone,
                                 List<MemberResponse> members, Instant createdAt) {
}
