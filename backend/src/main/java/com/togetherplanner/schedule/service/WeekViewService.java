package com.togetherplanner.schedule.service;

import com.togetherplanner.schedule.dto.WeekResponse;
import java.time.LocalDate;
import java.util.UUID;

/** The week screen: events, members and applied templates of one week in one answer. */
public interface WeekViewService {

    /** {@code date} defaults to "today" in the workspace's time zone, rounded back to Monday. */
    WeekResponse get(UUID wsId, UUID userId, LocalDate date);
}
