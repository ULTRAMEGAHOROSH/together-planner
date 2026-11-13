package com.togetherplanner.security;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * {@code app.security.*} из application.yml (spec §12.2). Валидация здесь
 * ловит опечатку в конфиге при старте, а не при первом запросе.
 */
@ConfigurationProperties(prefix = "app.security")
@Validated
public record SecurityProperties(
        @NotBlank String jwtSecret,
        @NotBlank String jwtIssuer,
        @NotNull Duration accessTokenTtl,
        @NotNull Duration refreshTokenTtl,
        @NotNull Duration refreshRotationGrace,
        boolean refreshCookieSecure) {
}
