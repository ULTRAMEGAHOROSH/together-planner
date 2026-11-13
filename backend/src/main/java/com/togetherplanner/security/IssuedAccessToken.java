package com.togetherplanner.security;

public record IssuedAccessToken(String token, long expiresInSeconds) {
}
