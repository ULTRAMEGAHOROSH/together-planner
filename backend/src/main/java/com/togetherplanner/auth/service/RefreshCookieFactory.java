package com.togetherplanner.auth.service;

import com.togetherplanner.security.SecurityProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** spec §10.4: cookie {@code tp_refresh}. */
@Component
@RequiredArgsConstructor
public class RefreshCookieFactory {

    private static final String COOKIE_NAME = "tp_refresh";
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final SecurityProperties properties;

    public ResponseCookie create(String rawToken) {
        return ResponseCookie.from(COOKIE_NAME, rawToken)
                .httpOnly(true)
                .secure(properties.refreshCookieSecure())
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(properties.refreshTokenTtl())
                .build();
    }

    /** Очистка: то же имя, путь и атрибуты, пустое значение, {@code Max-Age=0}. */
    public ResponseCookie clear() {
        return ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(properties.refreshCookieSecure())
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(0)
                .build();
    }
}
