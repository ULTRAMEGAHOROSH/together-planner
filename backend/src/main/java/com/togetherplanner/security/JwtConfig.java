package com.togetherplanner.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.Clock;
import java.util.Base64;

/**
 * Encoder/decoder for access tokens. A secret shorter than 32 bytes fails
 * at startup ({@code IllegalStateException}), not on the first request.
 */
@Configuration
@RequiredArgsConstructor
public class JwtConfig {

    private static final int MIN_SECRET_BYTES = 32;

    private final SecurityProperties properties;
    private final Clock clock;

    @Bean
    public SecretKey jwtSecretKey() {
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(properties.jwtSecret());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.security.jwt-secret must be valid base64", e);
        }
        if (keyBytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "app.security.jwt-secret must decode to at least " + MIN_SECRET_BYTES
                            + " bytes, got " + keyBytes.length);
        }
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        return NimbusJwtEncoder.withSecretKey(jwtSecretKey).build();
    }

    @Bean
    public JwtDecoder jwtDecoder(SecretKey jwtSecretKey) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        // Same Clock as token issuance - otherwise tokens issued under a test's
        // MutableClock would look expired against the system clock.
        // Zero skew tolerance is intentional: JwtTimestampValidator()'s default
        // 60s allowance would let a token that expired 60s ago still pass,
        // which is exactly the boundary test S-03 exercises.
        JwtTimestampValidator timestampValidator = new JwtTimestampValidator(java.time.Duration.ZERO);
        timestampValidator.setClock(clock);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                timestampValidator, new JwtIssuerValidator(properties.jwtIssuer())));
        return decoder;
    }
}
