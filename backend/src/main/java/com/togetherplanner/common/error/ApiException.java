package com.togetherplanner.common.error;

import lombok.Getter;

/**
 * The only business exception in the app. Anything expected - wrong
 * workspace, a version conflict, a bad password - comes through as an
 * {@link ErrorCode} instead of its own exception class.
 */
@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode code;

    public ApiException(ErrorCode code, String detail) {
        super(detail);
        this.code = code;
    }
}
