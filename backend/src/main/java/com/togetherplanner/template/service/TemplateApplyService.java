package com.togetherplanner.template.service;

import com.togetherplanner.common.web.PageResponse;
import com.togetherplanner.template.dto.ApplyPreviewResponse;
import com.togetherplanner.template.dto.ApplyResultResponse;
import com.togetherplanner.template.dto.ApplyTemplateRequest;
import com.togetherplanner.template.dto.TemplateApplicationResponse;
import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** {@code preview} and {@code apply} share the same {@code buildPlan} - so their business rules can never drift apart. */
public interface TemplateApplyService {

    /** Builds the plan without a lock and changes nothing. */
    ApplyPreviewResponse preview(UUID wsId, UUID userId, UUID templateId, ApplyTemplateRequest request);

    /** Applies the template: validates, locks the workspace, re-plans, then deletes/creates events. */
    ApplyResultResponse apply(UUID wsId, UUID userId, UUID templateId, ApplyTemplateRequest request);

    /** Application history for a workspace. */
    PageResponse<TemplateApplicationResponse> history(UUID wsId, UUID userId, Pageable pageable);

    /** Called by the schedule module; membership is already checked by the caller. */
    List<TemplateApplicationResponse> findApplicationsForWeek(UUID wsId, LocalDate weekStart);
}
