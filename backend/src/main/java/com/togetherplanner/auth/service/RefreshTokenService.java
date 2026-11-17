package com.togetherplanner.auth.service;

import com.togetherplanner.auth.dto.IssuedTokens;
import com.togetherplanner.auth.entity.RefreshToken;
import com.togetherplanner.auth.entity.RevokeReason;
import com.togetherplanner.auth.repository.RefreshTokenRepository;
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

/** spec §10.4. */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final int RAW_TOKEN_BYTES = 32;

    private final RefreshTokenRepository refreshTokenRepository;
    private final SecurityProperties properties;
    private final JwtService jwtService;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    /** Новая сессия (A1, A2) или продолжение после успешной ротации (A3). */
    public IssuedTokens issue(UUID userId) {
        String raw = generateRawToken();
        Instant now = clock.instant();
        Instant expiresAt = now.plus(properties.refreshTokenTtl());
        refreshTokenRepository.save(new RefreshToken(userId, sha256Hex(raw), now, expiresAt));

        IssuedAccessToken access = jwtService.issue(userId);
        return new IssuedTokens(userId, access, raw);
    }

    /**
     * Ротация (A3, spec §10.4). Массовый отзыв при обнаружении повторного
     * использования должен сохраниться, несмотря на то что сам запрос
     * отвечает {@code 401}.
     */
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
                    // Параллельный запрос (другая вкладка) успел ротировать первым;
                    // без побочных эффектов — frontend повторит запрос с новой cookie.
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
            // Гонку выиграл параллельный запрос между нашим SELECT и UPDATE.
            throw new ApiException(ErrorCode.REFRESH_TOKEN_ROTATED, "Concurrent rotation");
        }

        return issue(token.getUserId());
    }

    /**
     * Logout (A4): отзывает токен из cookie, если он активен. Работает без
     * access-токена; повторный вызов безопасен. {@code @Transactional} —
     * custom {@code @Modifying}-запросы репозитория, в отличие от базовых
     * методов {@code JpaRepository}, не оборачиваются в транзакцию сами.
     */
    @Transactional
    public void revoke(String rawCookieValue) {
        if (rawCookieValue == null || rawCookieValue.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(sha256Hex(rawCookieValue))
                .ifPresent(token -> refreshTokenRepository.revokeIfActive(token.getId(), RevokeReason.LOGOUT, clock.instant()));
    }

    /** Logout-all (A5): отзывает все активные токены пользователя. */
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
            // SHA-256 — стандартный алгоритм JDK, этого не может произойти.
            throw new IllegalStateException(e);
        }
    }
}
