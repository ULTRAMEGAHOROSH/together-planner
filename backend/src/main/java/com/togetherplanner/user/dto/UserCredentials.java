package com.togetherplanner.user.dto;

import java.util.UUID;

/** Единственное место, где {@code passwordHash} покидает модуль {@code user} — для сравнения в {@code auth}. */
public record UserCredentials(UUID id, String passwordHash) {
}
