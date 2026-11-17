package com.togetherplanner.workspace.controller;

import com.togetherplanner.workspace.dto.CreateWorkspaceRequest;
import com.togetherplanner.workspace.dto.InviteResponse;
import com.togetherplanner.workspace.dto.JoinWorkspaceRequest;
import com.togetherplanner.workspace.dto.MemberResponse;
import com.togetherplanner.workspace.dto.UpdateWorkspaceRequest;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import com.togetherplanner.workspace.service.InviteService;
import com.togetherplanner.workspace.service.WorkspaceAccessService;
import com.togetherplanner.workspace.service.WorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Workspace creation, lookup, updates, members and invites. */
@RestController
@RequestMapping("/api/v1/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final WorkspaceAccessService workspaceAccessService;
    private final InviteService inviteService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateWorkspaceRequest request) {
        return workspaceService.create(userIdOf(jwt), request);
    }

    @GetMapping("/current")
    public WorkspaceResponse current(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.current(userIdOf(jwt));
    }

    @PatchMapping("/{wsId}")
    public WorkspaceResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId,
                                     @Valid @RequestBody UpdateWorkspaceRequest request) {
        workspaceAccessService.requireMember(wsId, userIdOf(jwt));
        return workspaceService.update(wsId, request);
    }

    @GetMapping("/{wsId}/members")
    public List<MemberResponse> members(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId) {
        workspaceAccessService.requireMember(wsId, userIdOf(jwt));
        return workspaceService.members(wsId);
    }

    @PostMapping("/{wsId}/invites")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResponse createInvite(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID wsId) {
        UUID userId = userIdOf(jwt);
        workspaceAccessService.requireMember(wsId, userId);
        return inviteService.createInvite(wsId, userId);
    }

    @PostMapping("/join")
    public WorkspaceResponse join(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody JoinWorkspaceRequest request) {
        return inviteService.join(userIdOf(jwt), request);
    }

    private UUID userIdOf(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
