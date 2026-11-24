package com.togetherplanner.workspace.service;

import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;

public interface WorkspaceAccessService {

    void requireMember(UUID wsId, UUID userId);

    ZoneId zoneOf(UUID wsId);

    Set<UUID> memberIds(UUID wsId);

    void lockForUpdate(UUID wsId);
}
