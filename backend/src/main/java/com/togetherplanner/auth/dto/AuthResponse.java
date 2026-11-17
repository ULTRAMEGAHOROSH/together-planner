package com.togetherplanner.auth.dto;

import com.togetherplanner.user.dto.UserResponse;

public record AuthResponse(String accessToken, String tokenType /* "Bearer" */,
                            long expiresIn /* seconds */, UserResponse user) {
}
