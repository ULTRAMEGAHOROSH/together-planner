package com.togetherplanner.workspace.service;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * spec §9.6. Алфавит без похожих символов (0/O, 1/I/L). 8 символов ≈ 39 бит
 * энтропии — код одноразовый и живёт 7 дней, перебором не подобрать.
 */
@Component
public class InviteCodeGenerator {

    private static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
    private static final int CODE_LENGTH = 8;

    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(ALPHABET.charAt(secureRandom.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }

    /** Вход пользователя: без учёта регистра, дефисов и пробелов — {@code "k7qm-2xpa"} → {@code "K7QM2XPA"}. */
    public static String normalize(String input) {
        return input.toUpperCase(Locale.ROOT).replace("-", "").replace(" ", "");
    }

    /** Только для показа — хранится и сравнивается код без дефиса. */
    public static String toDisplayCode(String code) {
        return code.substring(0, 4) + "-" + code.substring(4);
    }
}
