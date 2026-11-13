package com.togetherplanner.user.service;

import com.togetherplanner.user.dto.UserCredentials;
import com.togetherplanner.user.dto.UserResponse;
import com.togetherplanner.user.entity.User;
import com.togetherplanner.user.mapper.UserMapper;
import com.togetherplanner.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/** Публичные методы — spec §6.4. Вызывается модулями {@code auth} и {@code workspace}. */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final Clock clock;

    public UUID create(String email, String displayName, String passwordHash) {
        User user = new User(email, displayName, passwordHash, clock.instant());
        return userRepository.save(user).getId();
    }

    public Optional<UserCredentials> findCredentialsByEmail(String email) {
        return userRepository.findByEmail(email)
                .map(u -> new UserCredentials(u.getId(), u.getPasswordHash()));
    }

    public UserResponse getById(UUID id) {
        User user = userRepository.findById(id)
                // Удаления пользователей в MVP нет (Д D-3): валидный JWT должен всегда
                // ссылаться на существующего пользователя. Если это не так — это баг,
                // а не ожидаемая клиентская ошибка, поэтому не ApiException.
                .orElseThrow(() -> new IllegalStateException(
                        "User " + id + " referenced by a valid token no longer exists"));
        return userMapper.toResponse(user);
    }

    public Map<UUID, String> displayNames(Collection<UUID> ids) {
        return userRepository.findByIdIn(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName));
    }
}
