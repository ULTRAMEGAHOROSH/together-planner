package com.togetherplanner.template.repository;

import com.togetherplanner.template.entity.TemplateApplication;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TemplateApplicationRepository extends JpaRepository<TemplateApplication, UUID> {

    /** Used for {@code TemplateResponse.lastApplication}. */
    Optional<TemplateApplication> findFirstByTemplateIdOrderByAppliedAtDesc(UUID templateId);

    /** Application history for a workspace. */
    Page<TemplateApplication> findByWorkspaceIdOrderByAppliedAtDesc(UUID workspaceId, Pageable pageable);

    /** Used for {@code WeekResponse.appliedTemplates} - called from the schedule module. */
    List<TemplateApplication> findByWorkspaceIdAndWeekStartOrderByAppliedAt(UUID workspaceId, LocalDate weekStart);
}
