package com.togetherplanner.template.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TemplateRequest(
        @NotBlank @Size(max = 60) String name,
        @Size(max = 500) String description,
        @NotNull @Size(max = 300) List<@Valid @NotNull TemplateEventRequest> events,
        Long version) {
}
