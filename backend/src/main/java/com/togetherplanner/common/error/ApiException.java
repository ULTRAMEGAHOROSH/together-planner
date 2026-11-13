package com.togetherplanner.common.error;

import lombok.Getter;

/**
 * Единственное бизнес-исключение приложения (spec §7.2). Любое ожидаемое
 * отклонение запроса — чужое пространство, конфликт версии, неверный пароль
 * и т.д. — выражается через {@link ErrorCode}, а не через отдельный класс
 * исключения.
 */
@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode code;

    public ApiException(ErrorCode code, String detail) {
        super(detail);
        this.code = code;
    }
}
