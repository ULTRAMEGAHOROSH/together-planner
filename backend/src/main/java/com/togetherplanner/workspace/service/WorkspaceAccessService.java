package com.togetherplanner.workspace.service;

import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;

/** Called by the event, template and schedule modules. */
public interface WorkspaceAccessService {

    /** First line of every public service method under {@code /workspaces/{wsId}}. */
    void requireMember(UUID wsId, UUID userId);

    ZoneId zoneOf(UUID wsId);

    Set<UUID> memberIds(UUID wsId);

    /**
     * The only pessimistic lock in the system - used solely for applying a
     * template. The caller must already be {@code @Transactional}: the
     * lock is held until that transaction ends.
     */
    void lockForUpdate(UUID wsId);
}
