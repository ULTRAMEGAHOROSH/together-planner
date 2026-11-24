package com.togetherplanner.template.service;

import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import java.util.List;
import java.util.UUID;

public interface TemplateService {

    List<TemplateResponse> list(UUID wsId, UUID userId);

    TemplateResponse create(UUID wsId, UUID userId, TemplateRequest request);

    TemplateResponse get(UUID wsId, UUID userId, UUID templateId);

    TemplateResponse update(UUID wsId, UUID userId, UUID templateId, TemplateRequest request);

    void delete(UUID wsId, UUID userId, UUID templateId, Long expectedVersion);
}
