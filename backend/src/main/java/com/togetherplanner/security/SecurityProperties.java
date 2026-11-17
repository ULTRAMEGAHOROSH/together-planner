package com.togetherplanner.security;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * {@code app.security.*} from application.yml. Validating here catches a
 * typo in the config at startup instead of on the first request.
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
