package com.togetherplanner.workspace.repository;

import com.togetherplanner.workspace.entity.WorkspaceMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {

    boolean existsByWorkspaceIdAndUserId(UUID workspaceId, UUID userId);

    /** One workspace per user, for now. */
    boolean existsByUserId(UUID userId);

    Optional<WorkspaceMember> findByUserId(UUID userId);

    /** Ordered by {@code seat}, not {@code joinedAt}. */
    List<WorkspaceMember> findByWorkspaceIdOrderBySeat(UUID workspaceId);

    long countByWorkspaceId(UUID workspaceId);
}
