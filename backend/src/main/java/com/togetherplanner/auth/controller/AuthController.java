package com.togetherplanner.auth.controller;

import com.togetherplanner.auth.dto.AuthResponse;
import com.togetherplanner.auth.dto.IssuedTokens;
import com.togetherplanner.auth.dto.LoginRequest;
import com.togetherplanner.auth.dto.MeResponse;
import com.togetherplanner.auth.dto.RegisterRequest;
import com.togetherplanner.auth.service.AuthService;
import com.togetherplanner.auth.service.RefreshCookieFactory;
import com.togetherplanner.auth.service.RefreshTokenService;
import com.togetherplanner.user.dto.UserResponse;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** A1–A6 (spec §8.3). */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String REFRESH_COOKIE_NAME = "tp_refresh";

    private final AuthService authService;
    private final RefreshTokenService refreshTokenService;
    private final RefreshCookieFactory refreshCookieFactory;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Parameter(name = "X-Requested-With", in = ParameterIn.HEADER, required = true, example = "XMLHttpRequest")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
        UserResponse user = authService.register(request);
        return issueTokensAndSetCookie(user, response);
    }

    @PostMapping("/login")
    @Parameter(name = "X-Requested-With", in = ParameterIn.HEADER, required = true, example = "XMLHttpRequest")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        UserResponse user = authService.login(request);
        return issueTokensAndSetCookie(user, response);
    }

    @PostMapping("/refresh")
    @Parameter(name = "X-Requested-With", in = ParameterIn.HEADER, required = true, example = "XMLHttpRequest")
    public AuthResponse refresh(@CookieValue(value = REFRESH_COOKIE_NAME, required = false) String refreshCookie,
                                 HttpServletResponse response) {
        IssuedTokens issued = refreshTokenService.rotate(refreshCookie);
        setCookie(response, refreshCookieFactory.create(issued.refreshTokenRaw()));
        UserResponse user = authService.me(issued.userId()).user();
        return new AuthResponse(issued.access().token(), "Bearer", issued.access().expiresInSeconds(), user);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Parameter(name = "X-Requested-With", in = ParameterIn.HEADER, required = true, example = "XMLHttpRequest")
    public void logout(@CookieValue(value = REFRESH_COOKIE_NAME, required = false) String refreshCookie,
                        HttpServletResponse response) {
        refreshTokenService.revoke(refreshCookie);
        setCookie(response, refreshCookieFactory.clear());
    }

    @PostMapping("/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutAll(@AuthenticationPrincipal Jwt jwt, HttpServletResponse response) {
        refreshTokenService.revokeAll(UUID.fromString(jwt.getSubject()));
        setCookie(response, refreshCookieFactory.clear());
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return authService.me(UUID.fromString(jwt.getSubject()));
    }

    private AuthResponse issueTokensAndSetCookie(UserResponse user, HttpServletResponse response) {
        IssuedTokens issued = refreshTokenService.issue(user.id());
        setCookie(response, refreshCookieFactory.create(issued.refreshTokenRaw()));
        return new AuthResponse(issued.access().token(), "Bearer", issued.access().expiresInSeconds(), user);
    }

    private void setCookie(HttpServletResponse response, org.springframework.http.ResponseCookie cookie) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
