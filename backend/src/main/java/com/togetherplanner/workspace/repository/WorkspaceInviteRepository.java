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

    /** Условный UPDATE (spec §9.6, шаг 6): {@code 0} означает, что гонку выиграл параллельный запрос. */
    @Modifying
    @Query("update WorkspaceInvite i set i.usedBy = :userId, i.usedAt = :now where i.id = :id and i.usedAt is null")
    int markUsed(@Param("id") UUID id, @Param("userId") UUID userId, @Param("now") Instant now);

    /** W5: прежние неиспользованные коды пространства удаляются при создании нового. */
    @Modifying
    @Query("delete from WorkspaceInvite i where i.workspaceId = :workspaceId and i.usedAt is null")
    int deleteUnusedByWorkspaceId(@Param("workspaceId") UUID workspaceId);
}
