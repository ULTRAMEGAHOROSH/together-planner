package com.togetherplanner.template.dto;

import com.togetherplanner.event.dto.EventResponse;

import java.util.List;

/** spec §8.8 — ответ T7. */
public record ApplyResultResponse(TemplateApplicationResponse application, List<EventResponse> createdEvents) {
}
