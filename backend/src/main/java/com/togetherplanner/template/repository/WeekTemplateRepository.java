package com.togetherplanner.template.repository;

import com.togetherplanner.template.entity.WeekTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeekTemplateRepository extends JpaRepository<WeekTemplate, UUID> {

    Optional<WeekTemplate> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    /** T1: «шаблоны отдаются целиком», сортировка по {@code name}. */
    List<WeekTemplate> findByWorkspaceIdOrderByName(UUID workspaceId);

    /** T2: {@code 409 TEMPLATE_NAME_TAKEN} без учёта регистра (совпадает с {@code uq_template_workspace_name}). */
    boolean existsByWorkspaceIdAndNameIgnoreCase(UUID workspaceId, String name);

    /** T4: та же проверка, но не считает совпадением сам редактируемый шаблон. */
    boolean existsByWorkspaceIdAndNameIgnoreCaseAndIdNot(UUID workspaceId, String name, UUID id);
}
