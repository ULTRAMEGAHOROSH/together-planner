package com.togetherplanner.auth.controller;

import com.togetherplanner.auth.dto.AuthResponse;
import com.togetherplanner.auth.dto.LoginRequest;
import com.togetherplanner.auth.dto.MeResponse;
import com.togetherplanner.auth.dto.RegisterRequest;
import com.togetherplanner.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** A1, A2, A6 (spec §8.3). A3–A5 добавятся в этапе 2.4. */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Parameter(name = "X-Requested-With", in = ParameterIn.HEADER, required = true, example = "XMLHttpRequest")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    @Parameter(name = "X-Requested-With", in = ParameterIn.HEADER, required = true, example = "XMLHttpRequest")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return authService.me(UUID.fromString(jwt.getSubject()));
    }
}
