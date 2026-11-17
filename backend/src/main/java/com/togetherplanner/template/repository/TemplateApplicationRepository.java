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

    /** {@code TemplateResponse.lastApplication} (T1, T3). */
    Optional<TemplateApplication> findFirstByTemplateIdOrderByAppliedAtDesc(UUID templateId);

    /** T8 — история применений по пространству. */
    Page<TemplateApplication> findByWorkspaceIdOrderByAppliedAtDesc(UUID workspaceId, Pageable pageable);

    /** {@code WeekResponse.appliedTemplates} (spec §8.5, этап 8) — межмодульный метод для {@code schedule}. */
    List<TemplateApplication> findByWorkspaceIdAndWeekStartOrderByAppliedAt(UUID workspaceId, LocalDate weekStart);
}
