package com.togetherplanner.schedule.service;

import com.togetherplanner.schedule.dto.WeekResponse;
import java.time.LocalDate;
import java.util.UUID;

public interface WeekViewService {

    WeekResponse get(UUID wsId, UUID userId, LocalDate date);
}
