package com.togetherplanner.event.service;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.common.time.TimeRules;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

/**
 * Validation rules shared by manual create, update, and template-driven
 * create, applied in this order: title, then time, then participants.
 */
@Component
public class EventValidator {

    private static final int MIN_YEAR = 2000;
    private static final int MAX_YEAR = 2100;
    private static final Duration MAX_DURATION = Duration.ofDays(31);

    /** Trims the title and rejects a blank one. */
    public String requireNonBlankTitle(String title) {
        String trimmed = title.trim();
        if (trimmed.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Title must not be blank");
        }
        return trimmed;
    }

    /** Truncates to the minute, normalizes for DST, then checks {@code end > start}, a 31-day cap, and a sane year range. */
    public ValidatedEventTimes normalizeAndValidateTimes(LocalDateTime start, LocalDateTime end, ZoneId zone) {
        LocalDateTime normalizedStart = TimeRules.normalize(start.truncatedTo(ChronoUnit.MINUTES), zone);
        LocalDateTime normalizedEnd = TimeRules.normalize(end.truncatedTo(ChronoUnit.MINUTES), zone);

        if (!normalizedEnd.isAfter(normalizedStart)) {
            throw new ApiException(ErrorCode.EVENT_END_NOT_AFTER_START, "End must be after start");
        }
        if (Duration.between(normalizedStart, normalizedEnd).compareTo(MAX_DURATION) > 0) {
            throw new ApiException(ErrorCode.EVENT_TOO_LONG, "Event must not be longer than 31 days");
        }
        int year = normalizedStart.getYear();
        if (year < MIN_YEAR || year > MAX_YEAR) {
            throw new ApiException(ErrorCode.EVENT_DATE_OUT_OF_RANGE, "Start year must be between " + MIN_YEAR + " and " + MAX_YEAR);
        }
        return new ValidatedEventTimes(normalizedStart, normalizedEnd);
    }

    /** Past events and overlaps with other events are both allowed - neither is checked here. */
    public void requireParticipantsAreMembers(Set<UUID> participantIds, Set<UUID> memberIds) {
        if (!memberIds.containsAll(participantIds)) {
            throw new ApiException(ErrorCode.EVENT_PARTICIPANT_NOT_MEMBER, "All participants must be workspace members");
        }
    }
}
