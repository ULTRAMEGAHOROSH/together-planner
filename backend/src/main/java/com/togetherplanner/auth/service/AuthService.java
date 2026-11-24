package com.togetherplanner.auth.service;

import com.togetherplanner.auth.dto.LoginRequest;
import com.togetherplanner.auth.dto.MeResponse;
import com.togetherplanner.auth.dto.RegisterRequest;
import com.togetherplanner.user.dto.UserResponse;
import java.util.UUID;

/** This class doesn't issue tokens - after a successful check, {@code AuthController} does that through {@code RefreshTokenService} (one call returns both the access and refresh token) so we never mint two access tokens with different {@code iat} values. */
public interface AuthService {

    UserResponse register(RegisterRequest request);

    UserResponse login(LoginRequest request);

    MeResponse me(UUID userId);
}
