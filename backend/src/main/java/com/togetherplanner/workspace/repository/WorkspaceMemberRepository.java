package com.togetherplanner.workspace.repository;

import com.togetherplanner.workspace.entity.WorkspaceMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {

    boolean existsByWorkspaceIdAndUserId(UUID workspaceId, UUID userId);

    /** MVP: одно пространство на человека (D-2, uq_member_user). */
    boolean existsByUserId(UUID userId);

    Optional<WorkspaceMember> findByUserId(UUID userId);

    /** Порядок по {@code seat} — не по {@code joinedAt} (A-29). */
    List<WorkspaceMember> findByWorkspaceIdOrderBySeat(UUID workspaceId);

    long countByWorkspaceId(UUID workspaceId);
}
