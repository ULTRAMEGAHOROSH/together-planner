package com.togetherplanner.user.service.impl;

import com.togetherplanner.user.dto.UserCredentials;
import com.togetherplanner.user.dto.UserResponse;
import com.togetherplanner.user.entity.User;
import com.togetherplanner.user.mapper.UserMapper;
import com.togetherplanner.user.repository.UserRepository;
import com.togetherplanner.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/** Called by the auth and workspace modules. */
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final Clock clock;

    @Override
    public UUID create(String email, String displayName, String passwordHash) {
        User user = new User(email, displayName, passwordHash, clock.instant());
        return userRepository.save(user).getId();
    }

    @Override
    public Optional<UserCredentials> findCredentialsByEmail(String email) {
        return userRepository.findByEmail(email)
                .map(u -> new UserCredentials(u.getId(), u.getPasswordHash()));
    }

    @Override
    public UserResponse getById(UUID id) {
        User user = userRepository.findById(id)
                // There's no user deletion in this app, so a valid JWT should
                // always point to an existing user. If it doesn't, that's a
                // bug, not an expected client error - hence IllegalStateException
                // rather than ApiException.
                .orElseThrow(() -> new IllegalStateException(
                        "User " + id + " referenced by a valid token no longer exists"));
        return userMapper.toResponse(user);
    }

    @Override
    public Map<UUID, String> displayNames(Collection<UUID> ids) {
        return userRepository.findByIdIn(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName));
    }
}
