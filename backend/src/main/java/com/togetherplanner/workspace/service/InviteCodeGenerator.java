package com.togetherplanner.workspace.service;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * Alphabet skips look-alike characters (0/O, 1/I/L). 8 characters gives
 * about 39 bits of entropy - more than enough given the code is
 * single-use and expires in 7 days anyway.
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

    /** Normalizes user input: case-insensitive, strips dashes and spaces - {@code "k7qm-2xpa"} becomes {@code "K7QM2XPA"}. */
    public static String normalize(String input) {
        return input.toUpperCase(Locale.ROOT).replace("-", "").replace(" ", "");
    }

    /** For display only - the code is stored and compared without the dash. */
    public static String toDisplayCode(String code) {
        return code.substring(0, 4) + "-" + code.substring(4);
    }
}
