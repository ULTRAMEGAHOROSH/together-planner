package com.togetherplanner.auth.service.impl;

import com.togetherplanner.auth.dto.IssuedTokens;
import com.togetherplanner.auth.entity.RefreshToken;
import com.togetherplanner.auth.entity.RevokeReason;
import com.togetherplanner.auth.repository.RefreshTokenRepository;
import com.togetherplanner.auth.service.RefreshTokenService;
import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.security.IssuedAccessToken;
import com.togetherplanner.security.JwtService;
import com.togetherplanner.security.SecurityProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

/** Issues, rotates and revokes refresh tokens. */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenServiceImpl implements RefreshTokenService {

    private static final int RAW_TOKEN_BYTES = 32;

    private final RefreshTokenRepository refreshTokenRepository;
    private final SecurityProperties properties;
    private final JwtService jwtService;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public IssuedTokens issue(UUID userId) {
        String raw = generateRawToken();
        Instant now = clock.instant();
        Instant expiresAt = now.plus(properties.refreshTokenTtl());
        refreshTokenRepository.save(new RefreshToken(userId, sha256Hex(raw), now, expiresAt));

        IssuedAccessToken access = jwtService.issue(userId);
        return new IssuedTokens(userId, access, raw);
    }

    @Override
    @Transactional(noRollbackFor = ApiException.class)
    public IssuedTokens rotate(String rawCookieValue) {
        if (rawCookieValue == null || rawCookieValue.isBlank()) {
            throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID, "Missing refresh token cookie");
        }
        RefreshToken token = refreshTokenRepository.findByTokenHash(sha256Hex(rawCookieValue))
                .orElseThrow(() -> new ApiException(ErrorCode.REFRESH_TOKEN_INVALID, "Unknown refresh token"));

        Instant now = clock.instant();

        if (token.getRevokedAt() != null) {
            if (token.getRevokeReason() == RevokeReason.ROTATED) {
                boolean withinGraceWindow = token.getRevokedAt().isAfter(now.minus(properties.refreshRotationGrace()));
                if (withinGraceWindow) {
                    // A concurrent request (another tab) rotated first; no side
                    // effects here - the frontend will retry with the new cookie.
                    throw new ApiException(ErrorCode.REFRESH_TOKEN_ROTATED, "Token was just rotated elsewhere");
                }
                refreshTokenRepository.revokeAllActive(token.getUserId(), RevokeReason.REUSE_DETECTED, now);
                log.warn("Refresh token reuse detected: userId={}", token.getUserId());
                throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID, "Refresh token reuse detected");
            }
            throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID, "Refresh token has been revoked");
        }

        if (!token.getExpiresAt().isAfter(now)) {
            throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID, "Refresh token has expired");
        }

        int updated = refreshTokenRepository.revokeIfActive(token.getId(), RevokeReason.ROTATED, now);
        if (updated == 0) {
            // A concurrent request won the race between our SELECT and UPDATE.
            throw new ApiException(ErrorCode.REFRESH_TOKEN_ROTATED, "Concurrent rotation");
        }

        return issue(token.getUserId());
    }

    @Override
    @Transactional
    public void revoke(String rawCookieValue) {
        if (rawCookieValue == null || rawCookieValue.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(sha256Hex(rawCookieValue))
                .ifPresent(token -> refreshTokenRepository.revokeIfActive(token.getId(), RevokeReason.LOGOUT, clock.instant()));
    }

    @Override
    @Transactional
    public void revokeAll(UUID userId) {
        refreshTokenRepository.revokeAllActive(userId, RevokeReason.LOGOUT_ALL, clock.instant());
    }

    private String generateRawToken() {
        byte[] bytes = new byte[RAW_TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256Hex(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is a standard JDK algorithm, this can't actually happen.
            throw new IllegalStateException(e);
        }
    }
}
