package com.togetherplanner.common.error;

/** One entry in the {@code ProblemDetail} "errors" array - field validation failures only. */
public record ValidationErrorItem(String field, String message) {
}
