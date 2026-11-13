package com.togetherplanner.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** spec §14.2: секрет короче 32 байт → {@code IllegalStateException} при старте, а не на первом запросе. */
class JwtConfigTest {

    @Test
    void secretShorterThan32BytesFailsFast() {
        SecurityProperties properties = new SecurityProperties(
                Base64.getEncoder().encodeToString("too-short".getBytes()),
                "together-planner",
                Duration.ofMinutes(15), Duration.ofDays(30), Duration.ofSeconds(10), false);
        JwtConfig config = new JwtConfig(properties, Clock.systemUTC());

        assertThatThrownBy(config::jwtSecretKey).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void nonBase64SecretFailsFast() {
        SecurityProperties properties = new SecurityProperties(
                "not-valid-base64!!!", "together-planner",
                Duration.ofMinutes(15), Duration.ofDays(30), Duration.ofSeconds(10), false);
        JwtConfig config = new JwtConfig(properties, Clock.systemUTC());

        assertThatThrownBy(config::jwtSecretKey).isInstanceOf(IllegalStateException.class);
    }
}
