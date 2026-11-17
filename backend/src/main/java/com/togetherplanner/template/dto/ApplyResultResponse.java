package com.togetherplanner.template.dto;

import com.togetherplanner.event.dto.EventResponse;

import java.util.List;

/** Response for applying a template. */
public record ApplyResultResponse(TemplateApplicationResponse application, List<EventResponse> createdEvents) {
}
