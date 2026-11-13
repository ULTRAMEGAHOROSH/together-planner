package com.togetherplanner.common.error;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * Каталог кодов ошибок (spec §7.4). Каждый код несёт собственный HTTP-статус,
 * чтобы {@link ApiException} не требовала указывать статус в каждом месте,
 * где её бросают.
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // 400
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST),
    INVALID_TIME_ZONE(HttpStatus.BAD_REQUEST),
    INVALID_DATE_RANGE(HttpStatus.BAD_REQUEST),
    PASSWORD_TOO_LONG(HttpStatus.BAD_REQUEST),
    EVENT_END_NOT_AFTER_START(HttpStatus.BAD_REQUEST),
    EVENT_TOO_LONG(HttpStatus.BAD_REQUEST),
    EVENT_DATE_OUT_OF_RANGE(HttpStatus.BAD_REQUEST),
    EVENT_PARTICIPANT_NOT_MEMBER(HttpStatus.BAD_REQUEST),
    VERSION_REQUIRED(HttpStatus.BAD_REQUEST),
    WEEK_START_NOT_MONDAY(HttpStatus.BAD_REQUEST),
    TEMPLATE_EVENT_NOT_FOUND(HttpStatus.BAD_REQUEST),
    REPLACE_CONFIRMATION_REQUIRED(HttpStatus.BAD_REQUEST),

    // 401
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED),
    REFRESH_TOKEN_ROTATED(HttpStatus.UNAUTHORIZED),

    // 403
    FORBIDDEN(HttpStatus.FORBIDDEN),
    CSRF_HEADER_MISSING(HttpStatus.FORBIDDEN),

    // 404
    WORKSPACE_NOT_FOUND(HttpStatus.NOT_FOUND),
    INVITE_NOT_FOUND(HttpStatus.NOT_FOUND),
    EVENT_NOT_FOUND(HttpStatus.NOT_FOUND),
    TEMPLATE_NOT_FOUND(HttpStatus.NOT_FOUND),

    // 409
    EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT),
    ALREADY_IN_WORKSPACE(HttpStatus.CONFLICT),
    WORKSPACE_FULL(HttpStatus.CONFLICT),
    INVITE_EXPIRED(HttpStatus.CONFLICT),
    INVITE_ALREADY_USED(HttpStatus.CONFLICT),
    TEMPLATE_NAME_TAKEN(HttpStatus.CONFLICT),
    VERSION_CONFLICT(HttpStatus.CONFLICT),
    TEMPLATE_APPLY_CONFLICT(HttpStatus.CONFLICT),
    APPLY_PLAN_OUTDATED(HttpStatus.CONFLICT),
    DATA_CONFLICT(HttpStatus.CONFLICT),

    // 500
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;
}
