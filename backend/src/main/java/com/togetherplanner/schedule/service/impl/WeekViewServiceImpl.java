package com.togetherplanner.schedule.service.impl;

import com.togetherplanner.common.time.TimeRules;
import com.togetherplanner.common.time.TimeService;
import com.togetherplanner.event.service.EventService;
import com.togetherplanner.schedule.dto.WeekResponse;
import com.togetherplanner.schedule.service.WeekViewService;
import com.togetherplanner.template.service.TemplateApplyService;
import com.togetherplanner.workspace.service.WorkspaceAccessService;
import com.togetherplanner.workspace.service.WorkspaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/** Assembles the week view: membership check, then members, events and applied templates. */
@Service
@RequiredArgsConstructor
public class WeekViewServiceImpl implements WeekViewService {

    private final WorkspaceAccessService workspaceAccessService;
    private final WorkspaceService workspaceService;
    private final EventService eventService;
    private final TemplateApplyService templateApplyService;
    private final TimeService timeService;

    @Override
    @Transactional(readOnly = true)
    public WeekResponse get(UUID wsId, UUID userId, LocalDate date) {
        workspaceAccessService.requireMember(wsId, userId);
        ZoneId zone = workspaceAccessService.zoneOf(wsId);
        LocalDate weekStart = TimeRules.weekStart(date != null ? date : timeService.today(zone));
        LocalDate weekEnd = weekStart.plusDays(6);

        return new WeekResponse(weekStart, weekEnd, zone.getId(),
                workspaceService.members(wsId),
                eventService.findOverlapping(wsId, weekStart.atStartOfDay(), weekStart.plusDays(7).atStartOfDay()),
                templateApplyService.findApplicationsForWeek(wsId, weekStart));
    }
}
