package com.togetherplanner.workspace.repository;

import com.togetherplanner.workspace.entity.WorkspaceInvite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceInviteRepository extends JpaRepository<WorkspaceInvite, UUID> {

    Optional<WorkspaceInvite> findByCode(String code);

    boolean existsByCode(String code);

    /** Conditional update - a result of {@code 0} means a concurrent join won the race. */
    @Modifying
    @Query("update WorkspaceInvite i set i.usedBy = :userId, i.usedAt = :now where i.id = :id and i.usedAt is null")
    int markUsed(@Param("id") UUID id, @Param("userId") UUID userId, @Param("now") Instant now);

    /** Deletes any unused invite codes for the workspace before a new one is issued. */
    @Modifying
    @Query("delete from WorkspaceInvite i where i.workspaceId = :workspaceId and i.usedAt is null")
    int deleteUnusedByWorkspaceId(@Param("workspaceId") UUID workspaceId);
}
