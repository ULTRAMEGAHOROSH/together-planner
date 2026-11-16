package com.togetherplanner.template.controller;

import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.template.service.TemplateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** T1–T5 (spec §8.7). T6–T8 — этапы 6–7. */
@RestController
@RequestMapping("/api/v1/workspaces/{wsId}/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;

    @GetMapping
    public List<TemplateResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId) {
        return templateService.list(wsId, userIdOf(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId,
                                    @Valid @RequestBody TemplateRequest request) {
        return templateService.create(wsId, userIdOf(jwt), request);
    }

    @GetMapping("/{templateId}")
    public TemplateResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId, @PathVariable UUID templateId) {
        return templateService.get(wsId, userIdOf(jwt), templateId);
    }

    @PutMapping("/{templateId}")
    public TemplateResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId, @PathVariable UUID templateId,
                                    @Valid @RequestBody TemplateRequest request) {
        return templateService.update(wsId, userIdOf(jwt), templateId, request);
    }

    @DeleteMapping("/{templateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId, @PathVariable UUID templateId,
                        @RequestParam(required = false) Long version) {
        templateService.delete(wsId, userIdOf(jwt), templateId, version);
    }

    private UUID userIdOf(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
