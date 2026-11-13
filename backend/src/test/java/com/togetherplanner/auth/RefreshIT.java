package com.togetherplanner.auth;

import com.jayway.jsonpath.JsonPath;
import com.togetherplanner.auth.entity.RevokeReason;
import com.togetherplanner.auth.repository.RefreshTokenRepository;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** spec §14.3 (I-17, I-18), §14.5 (S-07 полностью, S-08, S-09); roadmap 2.4. */
class RefreshIT extends AbstractIntegrationTest {

    private static final Pattern COOKIE_VALUE = Pattern.compile("tp_refresh=([^;]*)");

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    // I-17
    @Test
    void twoRotationsInARowBothSucceedWithDifferentCookiesAndRevokeTheOldOnes() throws Exception {
        String cookie1 = registerAndGetRefreshCookie("alice@example.com");

        MvcResult r1 = mockMvc.perform(authPost("/api/v1/auth/refresh").cookie(cookieOf(cookie1)))
                .andExpect(status().isOk())
                .andReturn();
        String cookie2 = extractCookieValue(r1);
        assertThat(cookie2).isNotEqualTo(cookie1);

        MvcResult r2 = mockMvc.perform(authPost("/api/v1/auth/refresh").cookie(cookieOf(cookie2)))
                .andExpect(status().isOk())
                .andReturn();
        String cookie3 = extractCookieValue(r2);
        assertThat(cookie3).isNotEqualTo(cookie2);

        assertThat(isRevoked(cookie1, RevokeReason.ROTATED)).isTrue();
        assertThat(isRevoked(cookie2, RevokeReason.ROTATED)).isTrue();
    }

    // I-18
    @Test
    void logoutAllThenRefreshWithOldCookieIsInvalid() throws Exception {
        MvcResult registerResult = mockMvc.perform(authPost("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"bob@example.com\",\"password\":\"password1\",\"displayName\":\"Bob\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String cookie = extractCookieValue(registerResult);
        String accessToken = JsonPath.read(registerResult.getResponse().getContentAsString(), "$.accessToken");

        mockMvc.perform(post("/api/v1/auth/logout-all").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(authPost("/api/v1/auth/refresh").cookie(cookieOf(cookie)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));
    }

    // S-08
    @Test
    void loginCookieHasExpectedAttributes() throws Exception {
        mockMvc.perform(authPost("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"carol@example.com\",\"password\":\"password1\",\"displayName\":\"Carol\"}"))
                .andExpect(status().isCreated());

        MvcResult loginResult = mockMvc.perform(authPost("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"carol@example.com\",\"password\":\"password1\"}"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Set-Cookie"))
                .andReturn();

        String setCookie = loginResult.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("HttpOnly");
        assertThat(setCookie).contains("SameSite=Strict");
        assertThat(setCookie).contains("Path=/api/v1/auth");
        assertThat(setCookie).contains("Max-Age=2592000");
    }

    // S-09
    @Test
    void reusingARotatedTokenAfterTheGraceWindowRevokesEverySession() throws Exception {
        String cookie1 = registerAndGetRefreshCookie("dave@example.com");

        mockMvc.perform(authPost("/api/v1/auth/refresh").cookie(cookieOf(cookie1)))
                .andExpect(status().isOk());

        clock.advance(Duration.ofSeconds(60));

        mockMvc.perform(authPost("/api/v1/auth/refresh").cookie(cookieOf(cookie1)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));

        // Проверка в БД после ответа 401: запись об отзыве сохранилась, несмотря на 401
        // (noRollbackFor = ApiException.class).
        assertThat(isRevoked(cookie1, RevokeReason.ROTATED)).isTrue();
    }

    // S-07, полностью: A1, A2, A3, A4 без X-Requested-With
    @Test
    void registerWithoutCsrfHeaderIsRejectedWithoutSideEffects() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"erin@example.com\",\"password\":\"password1\",\"displayName\":\"Erin\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_HEADER_MISSING"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void loginWithoutCsrfHeaderIsRejectedWithoutSideEffects() throws Exception {
        registerAndGetRefreshCookie("frank@example.com");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"frank@example.com\",\"password\":\"password1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_HEADER_MISSING"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void refreshWithoutCsrfHeaderIsRejectedWithoutRotating() throws Exception {
        String cookie = registerAndGetRefreshCookie("grace@example.com");

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(cookieOf(cookie)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_HEADER_MISSING"))
                .andExpect(header().doesNotExist("Set-Cookie"));

        assertThat(isRevoked(cookie, RevokeReason.ROTATED)).isFalse();
    }

    @Test
    void logoutWithoutCsrfHeaderIsRejectedWithoutRevoking() throws Exception {
        String cookie = registerAndGetRefreshCookie("henry@example.com");

        mockMvc.perform(post("/api/v1/auth/logout").cookie(cookieOf(cookie)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_HEADER_MISSING"))
                .andExpect(header().doesNotExist("Set-Cookie"));

        assertThat(isRevoked(cookie, RevokeReason.LOGOUT)).isFalse();
    }

    private String registerAndGetRefreshCookie(String email) throws Exception {
        MvcResult result = mockMvc.perform(authPost("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password1\",\"displayName\":\"Name\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return extractCookieValue(result);
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder authPost(String url) {
        return post(url).header("X-Requested-With", "XMLHttpRequest");
    }

    private jakarta.servlet.http.Cookie cookieOf(String value) {
        return new jakarta.servlet.http.Cookie("tp_refresh", value);
    }

    private String extractCookieValue(MvcResult result) {
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        Matcher matcher = COOKIE_VALUE.matcher(setCookie);
        assertThat(matcher.find()).as("Set-Cookie header contains tp_refresh").isTrue();
        return matcher.group(1);
    }

    private boolean isRevoked(String rawCookieValue, RevokeReason expectedReason) {
        String hash = sha256Hex(rawCookieValue);
        return refreshTokenRepository.findByTokenHash(hash)
                .map(t -> expectedReason.equals(t.getRevokeReason()) && t.getRevokedAt() != null)
                .orElse(false);
    }

    private String sha256Hex(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
