package com.togetherplanner.common.time;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

public interface TimeService {

    LocalDateTime now(ZoneId zone);

    LocalDate today(ZoneId zone);

    Instant nowInstant();
}
