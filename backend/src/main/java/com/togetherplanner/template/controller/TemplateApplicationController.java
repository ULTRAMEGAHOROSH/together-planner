package com.togetherplanner.template.controller;

import com.togetherplanner.common.web.PageResponse;
import com.togetherplanner.template.dto.TemplateApplicationResponse;
import com.togetherplanner.template.service.TemplateApplyService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Lists past template applications. */
@RestController
@RequestMapping("/api/v1/workspaces/{wsId}/template-applications")
@RequiredArgsConstructor
public class TemplateApplicationController {

    private final TemplateApplyService templateApplyService;

    @GetMapping
    public PageResponse<TemplateApplicationResponse> history(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId,
                                                               @RequestParam(defaultValue = "0") int page,
                                                               @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return templateApplyService.history(wsId, userIdOf(jwt), PageRequest.of(page, size));
    }

    private UUID userIdOf(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
