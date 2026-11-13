package com.togetherplanner.auth.dto;

import com.togetherplanner.security.IssuedAccessToken;

import java.util.UUID;

/** Пара токенов, выданная при register/login/refresh — ровно то, что нужно собрать в {@link AuthResponse} + cookie. */
public record IssuedTokens(UUID userId, IssuedAccessToken access, String refreshTokenRaw) {
}
