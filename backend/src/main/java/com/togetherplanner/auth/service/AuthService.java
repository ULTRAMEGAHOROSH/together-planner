package com.togetherplanner.auth.service;

import com.togetherplanner.auth.dto.LoginRequest;
import com.togetherplanner.auth.dto.MeResponse;
import com.togetherplanner.auth.dto.RegisterRequest;
import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.user.dto.UserCredentials;
import com.togetherplanner.user.dto.UserResponse;
import com.togetherplanner.user.service.UserService;
import com.togetherplanner.workspace.service.WorkspaceService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * This class doesn't issue tokens - after a successful check,
 * {@code AuthController} does that through {@code RefreshTokenService}
 * (one call returns both the access and refresh token) so we never mint
 * two access tokens with different {@code iat} values.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int MAX_PASSWORD_BYTES = 72;

    private final UserService userService;
    private final WorkspaceService workspaceService;
    private final PasswordEncoder passwordEncoder;

    // Computed once at startup: comparing against this when the email isn't
    // found takes the same time as a wrong-password check, so response
    // timing can't be used to probe whether an account exists.
    private String dummyHash;

    @PostConstruct
    void initDummyHash() {
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public UserResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        requirePasswordFitsBcryptLimit(request.password());

        if (userService.findCredentialsByEmail(email).isPresent()) {
            // Fast path with a clear message; the uq_app_user_email unique
            // index is the last line of defense if two registrations race.
            throw new ApiException(ErrorCode.EMAIL_ALREADY_REGISTERED, "Email is already registered");
        }

        String passwordHash = passwordEncoder.encode(request.password());
        UUID userId = userService.create(email, request.displayName(), passwordHash);
        log.info("User registered: userId={}", userId);
        return userService.getById(userId);
    }

    public UserResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        Optional<UserCredentials> credentials = userService.findCredentialsByEmail(email);
        String hashToCompare = credentials.map(UserCredentials::passwordHash).orElse(dummyHash);

        // matches() runs even when the email wasn't found - otherwise
        // response timing would leak whether the account exists.
        boolean passwordMatches = passwordEncoder.matches(request.password(), hashToCompare);
        if (credentials.isEmpty() || !passwordMatches) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }

        return userService.getById(credentials.get().id());
    }

    public MeResponse me(UUID userId) {
        UserResponse user = userService.getById(userId);
        return new MeResponse(user, workspaceService.findForUser(userId).orElse(null));
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private void requirePasswordFitsBcryptLimit(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new ApiException(ErrorCode.PASSWORD_TOO_LONG,
                    "Password must be at most " + MAX_PASSWORD_BYTES + " bytes when UTF-8 encoded");
        }
    }
}
