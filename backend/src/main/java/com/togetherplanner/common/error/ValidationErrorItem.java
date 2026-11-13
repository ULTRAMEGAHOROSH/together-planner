package com.togetherplanner.common.error;

/**
 * Один элемент массива {@code errors} в {@code ProblemDetail} (spec §7.1).
 * Присутствует только для ошибок валидации полей запроса.
 */
public record ValidationErrorItem(String field, String message) {
}
