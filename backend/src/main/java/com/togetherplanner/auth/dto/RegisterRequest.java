package com.togetherplanner.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72) String password,   // + проверка ≤ 72 байт в сервисе
        @NotBlank @Size(max = 50) String displayName) {
}
