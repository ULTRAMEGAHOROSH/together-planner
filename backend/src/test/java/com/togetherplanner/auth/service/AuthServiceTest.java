package com.togetherplanner.auth.service;

import com.togetherplanner.auth.dto.RegisterRequest;
import com.togetherplanner.common.error.ApiException;
import com.togetherplanner.common.error.ErrorCode;
import com.togetherplanner.user.dto.UserResponse;
import com.togetherplanner.user.service.UserService;
import com.togetherplanner.workspace.service.WorkspaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Pure unit tests with mocks - no Spring context. */
class AuthServiceTest {

    private final UserService userService = mock(UserService.class);
    private final WorkspaceService workspaceService = mock(WorkspaceService.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final AuthService authService = new AuthService(userService, workspaceService, passwordEncoder);

    @BeforeEach
    void initDummyHash() {
        when(passwordEncoder.encode(any())).thenReturn("dummy-hash");
        authService.initDummyHash();   // @PostConstruct runs manually here - there's no Spring context
    }

    @Test
    void passwordLongerThan72Utf8BytesIsRejected() {
        // 40 Cyrillic characters x 2 UTF-8 bytes each = 80 bytes, over the 72-byte limit.
        String password = "а".repeat(40);
        RegisterRequest request = new RegisterRequest("test@example.com", password, "Alice");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.PASSWORD_TOO_LONG);
    }

    @Test
    void emailIsTrimmedAndLowercasedBeforeLookupAndCreate() {
        UUID userId = UUID.randomUUID();
        when(userService.findCredentialsByEmail("a@x.com")).thenReturn(Optional.empty());
        when(userService.create(eq("a@x.com"), eq("Alice"), eq("dummy-hash"))).thenReturn(userId);
        when(userService.getById(userId)).thenReturn(new UserResponse(userId, "a@x.com", "Alice", Instant.now()));

        UserResponse result = authService.register(new RegisterRequest("  A@X.com ", "password1", "Alice"));

        verify(userService).findCredentialsByEmail("a@x.com");
        verify(userService).create("a@x.com", "Alice", "dummy-hash");
        assertThat(result.email()).isEqualTo("a@x.com");
    }

    @Test
    void duplicateEmailIsRejectedBeforeHittingTheDatabase() {
        when(userService.findCredentialsByEmail("taken@example.com"))
                .thenReturn(Optional.of(new com.togetherplanner.user.dto.UserCredentials(UUID.randomUUID(), "hash")));

        assertThatThrownBy(() -> authService.register(
                new RegisterRequest("taken@example.com", "password1", "Alice")))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.EMAIL_ALREADY_REGISTERED);
    }
}
