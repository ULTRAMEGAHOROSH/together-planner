package com.togetherplanner.auth.service;

import com.togetherplanner.auth.dto.AuthResponse;
import com.togetherplanner.auth.dto.LoginRequest;
import com.togetherplanner.auth.dto.MeResponse;
import com.togetherplanner.auth.dto.RegisterRequest;
import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.security.IssuedAccessToken;
import com.togetherplanner.security.JwtService;
import com.togetherplanner.user.dto.UserCredentials;
import com.togetherplanner.user.dto.UserResponse;
import com.togetherplanner.user.service.UserService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/** spec §8.3, §10.2. */
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int MAX_PASSWORD_BYTES = 72;

    private final UserService userService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    // Вычисляется один раз при старте (A-25): сравнение с ним при отсутствующем
    // email занимает то же время, что при неверном пароле, и не выдаёт,
    // существует ли аккаунт.
    private String dummyHash;

    @PostConstruct
    void initDummyHash() {
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        requirePasswordFitsBcryptLimit(request.password());

        if (userService.findCredentialsByEmail(email).isPresent()) {
            // Быстрый путь с понятным сообщением; уникальный индекс
            // uq_app_user_email — последний рубеж в гонке (C-05, через
            // ConstraintErrorMapper).
            throw new ApiException(ErrorCode.EMAIL_ALREADY_REGISTERED, "Email is already registered");
        }

        String passwordHash = passwordEncoder.encode(request.password());
        UUID userId = userService.create(email, request.displayName(), passwordHash);
        return authResponseFor(userId);
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        Optional<UserCredentials> credentials = userService.findCredentialsByEmail(email);
        String hashToCompare = credentials.map(UserCredentials::passwordHash).orElse(dummyHash);

        // matches() вызывается даже если email не найден — иначе время ответа
        // раскрывает существование email (A-25, §10.2).
        boolean passwordMatches = passwordEncoder.matches(request.password(), hashToCompare);
        if (credentials.isEmpty() || !passwordMatches) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }

        return authResponseFor(credentials.get().id());
    }

    public MeResponse me(UUID userId) {
        UserResponse user = userService.getById(userId);
        // workspace всегда null: пространств ещё нет (появится в этапе 3.2).
        return new MeResponse(user, null);
    }

    private AuthResponse authResponseFor(UUID userId) {
        UserResponse user = userService.getById(userId);
        IssuedAccessToken issued = jwtService.issue(userId);
        return new AuthResponse(issued.token(), "Bearer", issued.expiresInSeconds(), user);
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
