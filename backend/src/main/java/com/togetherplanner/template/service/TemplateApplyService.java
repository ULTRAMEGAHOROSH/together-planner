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

public interface TemplateApplyService {

    ApplyPreviewResponse preview(UUID wsId, UUID userId, UUID templateId, ApplyTemplateRequest request);

    ApplyResultResponse apply(UUID wsId, UUID userId, UUID templateId, ApplyTemplateRequest request);

    PageResponse<TemplateApplicationResponse> history(UUID wsId, UUID userId, Pageable pageable);

    List<TemplateApplicationResponse> findApplicationsForWeek(UUID wsId, LocalDate weekStart);
}
