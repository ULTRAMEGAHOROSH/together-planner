package com.togetherplanner.workspace.repository;

import com.togetherplanner.workspace.entity.Workspace;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {

    /**
     * The only pessimistic lock in the system - used solely for applying a
     * template. The caller must already be {@code @Transactional}: the
     * lock is held until that transaction ends; this call doesn't open
     * one on its own.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Workspace w where w.id = :id")
    Optional<Workspace> findByIdForUpdate(@Param("id") UUID id);
}
