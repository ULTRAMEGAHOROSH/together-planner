package com.togetherplanner.schedule.controller;

import com.togetherplanner.schedule.dto.WeekResponse;
import com.togetherplanner.schedule.service.WeekViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

/** S1 (spec §8.5). */
@RestController
@RequestMapping("/api/v1/workspaces/{wsId}/week")
@RequiredArgsConstructor
public class WeekController {

    private final WeekViewService weekViewService;

    @GetMapping
    public WeekResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId,
                             @RequestParam(required = false) LocalDate date) {
        return weekViewService.get(wsId, userIdOf(jwt), date);
    }

    private UUID userIdOf(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
