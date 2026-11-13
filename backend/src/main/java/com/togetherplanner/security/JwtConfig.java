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
 * Encoder/decoder для access-токенов (spec §10.3). Секрет короче 32 байт —
 * падение на старте (`IllegalStateException`), а не на первом запросе.
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
        // Тот же Clock, что и у выдачи токена — иначе тестовые токены,
        // выпущенные при MutableClock, окажутся «истёкшими» по системным часам.
        // Явный нулевой допуск: у JwtTimestampValidator() по умолчанию 60 с
        // допуска на расхождение часов, из-за чего «истёк 60 с назад» токен
        // всё ещё проходит — обнаружено тестом S-03 (exp + 16 мин на 15-минутном
        // токене даёт ровно 60 с просрочки, т.е. точную границу допуска).
        JwtTimestampValidator timestampValidator = new JwtTimestampValidator(java.time.Duration.ZERO);
        timestampValidator.setClock(clock);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                timestampValidator, new JwtIssuerValidator(properties.jwtIssuer())));
        return decoder;
    }
}
