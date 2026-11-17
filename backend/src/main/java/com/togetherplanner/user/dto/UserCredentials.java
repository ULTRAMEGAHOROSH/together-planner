package com.togetherplanner.user.dto;

import java.util.UUID;

/** The only place {@code passwordHash} leaves the user module - needed for comparison in auth. */
public record UserCredentials(UUID id, String passwordHash) {
}
