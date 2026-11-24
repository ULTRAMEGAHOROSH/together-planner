package com.togetherplanner.auth.service;

import com.togetherplanner.auth.dto.IssuedTokens;
import java.util.UUID;

public interface RefreshTokenService {

    IssuedTokens issue(UUID userId);

    IssuedTokens rotate(String rawCookieValue);

    void revoke(String rawCookieValue);

    void revokeAll(UUID userId);
}
