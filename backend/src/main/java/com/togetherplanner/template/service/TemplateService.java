package com.togetherplanner.template.service;

import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import java.util.List;
import java.util.UUID;

/** Templates of a workspace: CRUD with version checks. */
public interface TemplateService {

    /** Templates are returned in full, ordered by {@code name}. */
    List<TemplateResponse> list(UUID wsId, UUID userId);

    /** {@code name} is trimmed; a non-null {@code id} on a new event is rejected as a validation error. */
    TemplateResponse create(UUID wsId, UUID userId, TemplateRequest request);

    TemplateResponse get(UUID wsId, UUID userId, UUID templateId);

    /** Updates by diffing events by id. Doesn't touch any Event rows - events already created from this template are left as they are. */
    TemplateResponse update(UUID wsId, UUID userId, UUID templateId, TemplateRequest request);

    /** Events are left alone; the application history keeps {@code templateId = null}; exclusions cascade-delete. */
    void delete(UUID wsId, UUID userId, UUID templateId, Long expectedVersion);
}
