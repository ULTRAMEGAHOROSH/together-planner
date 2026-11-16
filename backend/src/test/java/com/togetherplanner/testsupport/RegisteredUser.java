package com.togetherplanner.testsupport;

import java.util.UUID;

public record RegisteredUser(UUID userId, String accessToken, String refreshCookie) {
}
