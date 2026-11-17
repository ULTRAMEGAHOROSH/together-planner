package com.togetherplanner.security;

import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The issued token should carry {@code iss}, {@code sub} and {@code exp = iat + 15 min}. */
class JwtServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-06T06:00:00Z");

    @Test
    void issuedTokenContainsIssuerSubjectAndFifteenMinuteExpiry() throws Exception {
        SecurityProperties properties = new SecurityProperties(
                Base64.getEncoder().encodeToString("x".repeat(32).getBytes()),
                "together-planner",
                Duration.ofMinutes(15), Duration.ofDays(30), Duration.ofSeconds(10), false);
        SecretKey key = new SecretKeySpec(Base64.getDecoder().decode(properties.jwtSecret()), "HmacSHA256");
        JwtEncoder encoder = NimbusJwtEncoder.withSecretKey(key).build();
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        JwtService service = new JwtService(encoder, properties, clock);

        UUID userId = UUID.randomUUID();
        IssuedAccessToken issued = service.issue(userId);

        JWTClaimsSet claims = SignedJWT.parse(issued.token()).getJWTClaimsSet();
        assertThat(claims.getIssuer()).isEqualTo("together-planner");
        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.getIssueTime().toInstant()).isEqualTo(NOW);
        assertThat(claims.getExpirationTime().toInstant()).isEqualTo(NOW.plus(Duration.ofMinutes(15)));
        assertThat(issued.expiresInSeconds()).isEqualTo(900L);
    }
}
