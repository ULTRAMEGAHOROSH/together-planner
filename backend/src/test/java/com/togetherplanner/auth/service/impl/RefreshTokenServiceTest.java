package com.togetherplanner.auth.service.impl;

import com.togetherplanner.auth.dto.IssuedTokens;
import com.togetherplanner.auth.entity.RefreshToken;
import com.togetherplanner.auth.entity.RevokeReason;
import com.togetherplanner.auth.repository.RefreshTokenRepository;
import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.security.IssuedAccessToken;
import com.togetherplanner.security.JwtService;
import com.togetherplanner.security.SecurityProperties;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Pure unit tests with mocks - no Spring context. */
class RefreshTokenServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-06T06:00:00Z");

    private final RefreshTokenRepository repository = mock(RefreshTokenRepository.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final SecurityProperties properties = new SecurityProperties(
            Base64.getEncoder().encodeToString("x".repeat(32).getBytes()), "together-planner",
            Duration.ofMinutes(15), Duration.ofDays(30), Duration.ofSeconds(10), false);
    private final RefreshTokenServiceImpl service = new RefreshTokenServiceImpl(repository, properties, jwtService, clock);

    @Test
    void validTokenIsRotatedAndANewOneIsIssued() {
        RefreshToken token = activeToken();
        when(repository.findByTokenHash(any())).thenReturn(Optional.of(token));
        when(repository.revokeIfActive(token.getId(), RevokeReason.ROTATED, NOW)).thenReturn(1);
        when(jwtService.issue(token.getUserId())).thenReturn(new IssuedAccessToken("new-access-token", 900L));

        IssuedTokens result = service.rotate("raw-cookie-value");

        assertThat(result.userId()).isEqualTo(token.getUserId());
        assertThat(result.access().token()).isEqualTo("new-access-token");
        verify(repository).revokeIfActive(token.getId(), RevokeReason.ROTATED, NOW);
        verify(repository).save(any(RefreshToken.class));
    }

    @Test
    void tokenRotatedFiveSecondsAgoIsRejectedWithoutMassRevoke() {
        RefreshToken token = revokedToken(RevokeReason.ROTATED, NOW.minusSeconds(5));
        when(repository.findByTokenHash(any())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.rotate("raw"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.REFRESH_TOKEN_ROTATED);

        verify(repository, never()).revokeAllActive(any(), any(), any());
    }

    @Test
    void tokenRotatedSixtySecondsAgoTriggersMassRevoke() {
        RefreshToken token = revokedToken(RevokeReason.ROTATED, NOW.minusSeconds(60));
        when(repository.findByTokenHash(any())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.rotate("raw"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.REFRESH_TOKEN_INVALID);

        verify(repository).revokeAllActive(token.getUserId(), RevokeReason.REUSE_DETECTED, NOW);
    }

    @Test
    void expiredTokenIsInvalid() {
        RefreshToken token = activeToken();
        token.setExpiresAt(NOW.minusSeconds(1));
        when(repository.findByTokenHash(any())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.rotate("raw"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    @Test
    void loggedOutTokenIsInvalidWithoutMassRevoke() {
        RefreshToken token = revokedToken(RevokeReason.LOGOUT, NOW.minusSeconds(5));
        when(repository.findByTokenHash(any())).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.rotate("raw"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.REFRESH_TOKEN_INVALID);

        verify(repository, never()).revokeAllActive(any(), any(), any());
    }

    @Test
    void revokeIfActiveReturningZeroMeansConcurrentRotationWon() {
        RefreshToken token = activeToken();
        when(repository.findByTokenHash(any())).thenReturn(Optional.of(token));
        when(repository.revokeIfActive(token.getId(), RevokeReason.ROTATED, NOW)).thenReturn(0);

        assertThatThrownBy(() -> service.rotate("raw"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.REFRESH_TOKEN_ROTATED);
    }

    private RefreshToken activeToken() {
        RefreshToken token = new RefreshToken(UUID.randomUUID(), "hash", NOW.minusSeconds(100), NOW.plus(Duration.ofDays(1)));
        token.setId(UUID.randomUUID());
        return token;
    }

    private RefreshToken revokedToken(RevokeReason reason, Instant revokedAt) {
        RefreshToken token = activeToken();
        token.setRevokedAt(revokedAt);
        token.setRevokeReason(reason);
        return token;
    }
}
