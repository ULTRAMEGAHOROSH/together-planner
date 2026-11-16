package com.togetherplanner.event.controller;

import com.togetherplanner.event.dto.EventRequest;
import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.service.EventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
import java.util.UUID;

/** E3–E6 (spec §8.6). E1, E2 добавятся в этапе 4.4. */
@RestController
@RequestMapping("/api/v1/workspaces/{wsId}/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

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
