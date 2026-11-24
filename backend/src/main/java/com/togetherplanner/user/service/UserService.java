package com.togetherplanner.user.service;

import com.togetherplanner.user.dto.UserCredentials;
import com.togetherplanner.user.dto.UserResponse;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Users: creation and lookups (credentials, profile, display names). */
public interface UserService {

    UUID create(String email, String displayName, String passwordHash);

    Optional<UserCredentials> findCredentialsByEmail(String email);

    UserResponse getById(UUID id);

    Map<UUID, String> displayNames(Collection<UUID> ids);
}
