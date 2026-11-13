package com.togetherplanner.auth;

import com.jayway.jsonpath.JsonPath;
import com.togetherplanner.security.IssuedAccessToken;
import com.togetherplanner.security.JwtService;
import com.togetherplanner.security.SecurityProperties;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MvcResult;

import javax.crypto.spec.SecretKeySpec;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** spec §8.3 (A1, A2, A6); roadmap 2.3. S-01–S-03 здесь, а не на временном эндпоинте этапа 2.2. */
class AuthIT extends AbstractIntegrationTest {

    @Autowired
    private JwtService jwtService;

    @Autowired
    private SecurityProperties properties;

    @Test
    void registerThenLoginThenMe() throws Exception {
        registerAlice();

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Requested-With", "XMLHttpRequest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@example.com\",\"password\":\"password1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value("alice@example.com"))
                .andReturn();

        String accessToken = JsonPath.read(loginResult.getResponse().getContentAsString(), "$.accessToken");

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("alice@example.com"))
                .andExpect(jsonPath("$.user.displayName").value("Alice"))
                .andExpect(jsonPath("$.workspace").value(nullValue()));
    }

    @Test
    void duplicateEmailReturns409() throws Exception {
        registerAlice();

        mockMvc.perform(post("/api/v1/auth/register")
                        .header("X-Requested-With", "XMLHttpRequest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@example.com\",\"password\":\"password2\",\"displayName\":\"Other\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));
    }

    @Test
    void wrongPasswordReturns401InvalidCredentials() throws Exception {
        registerAlice();

        mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Requested-With", "XMLHttpRequest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@example.com\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void unknownEmailReturns401InvalidCredentials() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Requested-With", "XMLHttpRequest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody@example.com\",\"password\":\"password1\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    // S-07 (часть): регистрация без X-Requested-With
    @Test
    void registerWithoutCsrfHeaderReturns403() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"dave@example.com\",\"password\":\"password1\",\"displayName\":\"Dave\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_HEADER_MISSING"));
    }

    // S-01
    @Test
    void meWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    // S-02 — подделанная подпись
    @Test
    void meWithForgedSignatureReturns401() throws Exception {
        JwtEncoder wrongKeyEncoder = NimbusJwtEncoder.withSecretKey(
                new SecretKeySpec("y".repeat(32).getBytes(), "HmacSHA256")).build();
        String forged = encodeWith(wrongKeyEncoder, properties.jwtIssuer());

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }

    // S-02 — чужой iss (подпись настоящим ключом)
    @Test
    void meWithWrongIssuerReturns401() throws Exception {
        JwtEncoder realKeyEncoder = NimbusJwtEncoder.withSecretKey(
                new SecretKeySpec(Base64.getDecoder().decode(properties.jwtSecret()), "HmacSHA256")).build();
        String wrongIssuer = encodeWith(realKeyEncoder, "someone-else");

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + wrongIssuer))
                .andExpect(status().isUnauthorized());
    }

    // S-03
    @Test
    void meWithExpiredTokenReturns401() throws Exception {
        IssuedAccessToken issued = jwtService.issue(UUID.randomUUID());

        clock.advance(Duration.ofMinutes(16));

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + issued.token()))
                .andExpect(status().isUnauthorized());
    }

    private void registerAlice() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .header("X-Requested-With", "XMLHttpRequest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@example.com\",\"password\":\"password1\",\"displayName\":\"Alice\"}"))
                .andExpect(status().isCreated());
    }

    private String encodeWith(JwtEncoder encoder, String issuer) {
        return encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder()
                        .issuer(issuer)
                        .subject(UUID.randomUUID().toString())
                        .issuedAt(clock.instant())
                        .expiresAt(clock.instant().plus(Duration.ofMinutes(15)))
                        .build())).getTokenValue();
    }
}
