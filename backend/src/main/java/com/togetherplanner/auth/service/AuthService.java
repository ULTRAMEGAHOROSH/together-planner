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
 * spec §8.3, §10.2. Выдачу токенов этот класс не делает — её после успешной
 * проверки делает {@code AuthController} через {@code RefreshTokenService}
 * (один вызов даёт и access-, и refresh-токен, spec §10.4), чтобы не
 * выпускать access-токен дважды с разными {@code iat}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int MAX_PASSWORD_BYTES = 72;

    private final UserService userService;
    private final WorkspaceService workspaceService;
    private final PasswordEncoder passwordEncoder;

    // Вычисляется один раз при старте (A-25): сравнение с ним при отсутствующем
    // email занимает то же время, что при неверном пароле, и не выдаёт,
    // существует ли аккаунт.
    private String dummyHash;

    @PostConstruct
    void initDummyHash() {
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public UserResponse register(RegisterRequest request) {
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
        log.info("User registered: userId={}", userId);
        return userService.getById(userId);
    }

    public UserResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        Optional<UserCredentials> credentials = userService.findCredentialsByEmail(email);
        String hashToCompare = credentials.map(UserCredentials::passwordHash).orElse(dummyHash);

        // matches() вызывается даже если email не найден — иначе время ответа
        // раскрывает существование email (A-25, §10.2).
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
