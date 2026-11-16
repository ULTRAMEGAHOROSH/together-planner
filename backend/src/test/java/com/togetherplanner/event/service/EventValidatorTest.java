package com.togetherplanner.event.service;

import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** spec §14.2: все кейсы {@code EventValidator}. */
class EventValidatorTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Almaty");

    private final EventValidator validator = new EventValidator();

    @Test
    void blankTitleAfterTrimIsRejected() {
        assertThatThrownBy(() -> validator.requireNonBlankTitle("   "))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    void titleIsTrimmed() {
        assertThat(validator.requireNonBlankTitle("  Work  ")).isEqualTo("Work");
    }

    @Test
    void endEqualToStartIsRejected() {
        LocalDateTime t = LocalDateTime.of(2026, 11, 9, 9, 0);
        assertThatThrownBy(() -> validator.normalizeAndValidateTimes(t, t, ZONE))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.EVENT_END_NOT_AFTER_START);
    }

    @Test
    void crossingMidnightIsAllowed() {
        ValidatedEventTimes result = validator.normalizeAndValidateTimes(
                LocalDateTime.of(2026, 11, 13, 23, 0), LocalDateTime.of(2026, 11, 14, 7, 0), ZONE);
        assertThat(result.start()).isEqualTo(LocalDateTime.of(2026, 11, 13, 23, 0));
        assertThat(result.end()).isEqualTo(LocalDateTime.of(2026, 11, 14, 7, 0));
    }

    @Test
    void exactlyThirtyOneDaysIsAllowed() {
        LocalDateTime start = LocalDateTime.of(2026, 1, 1, 0, 0);
        LocalDateTime end = start.plusDays(31);
        ValidatedEventTimes result = validator.normalizeAndValidateTimes(start, end, ZONE);
        assertThat(result.end()).isEqualTo(end);
    }

    @Test
    void thirtyOneDaysPlusOneMinuteIsRejected() {
        LocalDateTime start = LocalDateTime.of(2026, 1, 1, 0, 0);
        LocalDateTime end = start.plusDays(31).plusMinutes(1);
        assertThatThrownBy(() -> validator.normalizeAndValidateTimes(start, end, ZONE))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.EVENT_TOO_LONG);
    }

    @Test
    void yearBefore2000IsRejected() {
        LocalDateTime start = LocalDateTime.of(1999, 12, 31, 23, 0);
        LocalDateTime end = start.plusHours(1);
        assertThatThrownBy(() -> validator.normalizeAndValidateTimes(start, end, ZONE))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.EVENT_DATE_OUT_OF_RANGE);
    }

    @Test
    void secondsAreTruncatedToMinutes() {
        LocalDateTime start = LocalDateTime.of(2026, 11, 9, 9, 15, 47);
        LocalDateTime end = start.plusHours(1);
        ValidatedEventTimes result = validator.normalizeAndValidateTimes(start, end, ZONE);
        assertThat(result.start()).isEqualTo(LocalDateTime.of(2026, 11, 9, 9, 15, 0));
    }

    @Test
    void participantNotInWorkspaceIsRejected() {
        UUID member = UUID.randomUUID();
        UUID stranger = UUID.randomUUID();
        assertThatThrownBy(() -> validator.requireParticipantsAreMembers(Set.of(member, stranger), Set.of(member)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.EVENT_PARTICIPANT_NOT_MEMBER);
    }

    @Test
    void allParticipantsInWorkspaceIsAccepted() {
        UUID member = UUID.randomUUID();
        validator.requireParticipantsAreMembers(Set.of(member), Set.of(member, UUID.randomUUID()));
    }
}
