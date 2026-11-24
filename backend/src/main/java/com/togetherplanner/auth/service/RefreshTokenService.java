package com.togetherplanner.auth.service;

import com.togetherplanner.auth.dto.IssuedTokens;
import java.util.UUID;

/** Refresh tokens: issue, rotate with reuse detection, revoke. */
public interface RefreshTokenService {

    /** New session (register/login), or a continuation after a successful rotation. */
    IssuedTokens issue(UUID userId);

    /**
     * Rotates the refresh token. A bulk revoke triggered by detected reuse
     * has to survive even though this request itself responds with
     * {@code 401} - hence {@code noRollbackFor}.
     */
    IssuedTokens rotate(String rawCookieValue);

    /**
     * Revokes the token from the cookie if it's still active. Works
     * without an access token; safe to call more than once. Needs
     * {@code @Transactional} explicitly - custom {@code @Modifying}
     * queries aren't auto-wrapped in a transaction the way the base
     * {@code JpaRepository} methods are.
     */
    void revoke(String rawCookieValue);

    /** Revokes every active refresh token for the user. */
    void revokeAll(UUID userId);
}
