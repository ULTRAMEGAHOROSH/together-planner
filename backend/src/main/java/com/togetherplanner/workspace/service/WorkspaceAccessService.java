package com.togetherplanner.workspace.service;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.workspace.entity.Workspace;
import com.togetherplanner.workspace.entity.WorkspaceMember;
import com.togetherplanner.workspace.repository.WorkspaceMemberRepository;
import com.togetherplanner.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Публичные методы — spec §6.4. Вызывается модулями {@code event},
 * {@code template}, {@code schedule}. Межмодульные методы не проверяют
 * членство сами — его проверяет вызывающий публичный метод ровно один раз,
 * на входе сценария (spec §6.2, правило 4).
 */
@Service
@RequiredArgsConstructor
public class WorkspaceAccessService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    /** Первая строка каждого публичного метода сервиса под {@code /workspaces/{wsId}} (spec §9.0). */
    public void requireMember(UUID wsId, UUID userId) {
        if (!workspaceMemberRepository.existsByWorkspaceIdAndUserId(wsId, userId)) {
            // Чужое или несуществующее пространство — 404, никогда 403 (spec §8.0).
            throw new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found");
        }
    }

    public ZoneId zoneOf(UUID wsId) {
        return workspaceRepository.findById(wsId)
                .map(Workspace::zoneId)
                .orElseThrow(() -> new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));
    }

    public Set<UUID> memberIds(UUID wsId) {
        return workspaceMemberRepository.findByWorkspaceIdOrderBySeat(wsId).stream()
                .map(WorkspaceMember::getUserId)
                .collect(Collectors.toSet());
    }

    /**
     * Единственная пессимистическая блокировка в системе (spec §11) — только
     * для применения шаблона (этап 7). Вызывающий метод уже должен быть
     * {@code @Transactional}: лок живёт до конца его транзакции.
     */
    public void lockForUpdate(UUID wsId) {
        workspaceRepository.findByIdForUpdate(wsId)
                .orElseThrow(() -> new ApiException(ErrorCode.WORKSPACE_NOT_FOUND, "Workspace not found"));
    }
}
