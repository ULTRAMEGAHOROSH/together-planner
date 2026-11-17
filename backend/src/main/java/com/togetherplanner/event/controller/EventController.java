package com.togetherplanner.event.controller;

import com.togetherplanner.common.web.PageResponse;
import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.service.EventService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
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

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Event CRUD, plus range and upcoming lookups. */
@RestController
@RequestMapping("/api/v1/workspaces/{wsId}/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public List<EventResponse> range(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId,
                                      @RequestParam LocalDate from, @RequestParam LocalDate to) {
        return eventService.listRange(wsId, userIdOf(jwt), from, to);
    }

    @GetMapping("/upcoming")
    public PageResponse<EventResponse> upcoming(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return eventService.upcoming(wsId, userIdOf(jwt), PageRequest.of(page, size));
    }

    @PostMapping
    public ResponseEntity<EventResponse> create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId,
                                                 @Valid @RequestBody EventRequest request) {
        EventResponse response = eventService.create(wsId, userIdOf(jwt), request);
        return ResponseEntity.created(URI.create("/api/v1/workspaces/" + wsId + "/events/" + response.id()))
                .body(response);
    }

    @GetMapping("/{eventId}")
    public EventResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId, @PathVariable UUID eventId) {
        return eventService.get(wsId, userIdOf(jwt), eventId);
    }

    @PutMapping("/{eventId}")
    public EventResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId, @PathVariable UUID eventId,
                                 @Valid @RequestBody EventRequest request) {
        return eventService.update(wsId, userIdOf(jwt), eventId, request);
    }

    @DeleteMapping("/{eventId}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId, @PathVariable UUID eventId,
                        @RequestParam(required = false) Long version) {
        eventService.deleteByUser(wsId, userIdOf(jwt), eventId, version);
    }

    private UUID userIdOf(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
