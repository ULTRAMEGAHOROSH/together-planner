package com.togetherplanner.template.repository;

import com.togetherplanner.template.entity.TemplateApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TemplateApplicationRepository extends JpaRepository<TemplateApplication, UUID> {

    /** {@code TemplateResponse.lastApplication} (T1, T3). */
    Optional<TemplateApplication> findFirstByTemplateIdOrderByAppliedAtDesc(UUID templateId);
}
