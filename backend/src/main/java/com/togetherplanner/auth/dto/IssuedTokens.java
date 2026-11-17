package com.togetherplanner.auth.dto;

import com.togetherplanner.security.IssuedAccessToken;

import java.util.UUID;

/** Token pair issued on register/login/refresh - exactly what's needed to build an {@link AuthResponse} plus the cookie. */
public record IssuedTokens(UUID userId, IssuedAccessToken access, String refreshTokenRaw) {
}
