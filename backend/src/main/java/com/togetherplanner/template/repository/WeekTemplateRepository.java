package com.togetherplanner.template.repository;

import com.togetherplanner.template.entity.WeekTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeekTemplateRepository extends JpaRepository<WeekTemplate, UUID> {

    Optional<WeekTemplate> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    /** Templates are listed in full, ordered by {@code name}. */
    List<WeekTemplate> findByWorkspaceIdOrderByName(UUID workspaceId);

    /** Case-insensitive, matching {@code uq_template_workspace_name}. */
    boolean existsByWorkspaceIdAndNameIgnoreCase(UUID workspaceId, String name);

    /** Same check, but excludes the template currently being edited. */
    boolean existsByWorkspaceIdAndNameIgnoreCaseAndIdNot(UUID workspaceId, String name, UUID id);
}
