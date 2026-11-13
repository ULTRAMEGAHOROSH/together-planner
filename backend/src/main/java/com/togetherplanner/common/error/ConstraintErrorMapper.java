package com.togetherplanner.common.error;

import lombok.extern.slf4j.Slf4j;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Последний рубеж против гонок, которые не поймала проверка в сервисе
 * (spec §7.3, A-10). Проверки в сервисах остаются быстрым путём с понятным
 * сообщением; этот класс превращает нарушение ограничения БД в тот же код
 * ошибки, который дал бы сервис, если бы увидел конфликт раньше.
 *
 * <p>После нарушения ограничения транзакция PostgreSQL прервана: «поймать
 * и повторить» внутри неё нельзя, только ответить ошибкой.
 */
@Slf4j
@Component
public class ConstraintErrorMapper {

    private static final Map<String, ErrorCode> BY_CONSTRAINT = Map.of(
            "uq_app_user_email", ErrorCode.EMAIL_ALREADY_REGISTERED,
            "uq_member_user", ErrorCode.ALREADY_IN_WORKSPACE,
            "uq_member_workspace_user", ErrorCode.ALREADY_IN_WORKSPACE,
            "uq_member_workspace_seat", ErrorCode.WORKSPACE_FULL,
            "uq_template_workspace_name", ErrorCode.TEMPLATE_NAME_TAKEN,
            "uq_event_template_source", ErrorCode.TEMPLATE_APPLY_CONFLICT);

    public ErrorCode map(DataIntegrityViolationException ex) {
        String constraintName = constraintNameOf(ex);
        if (constraintName == null) {
            log.warn("DataIntegrityViolationException without a recognizable constraint name", ex);
            return ErrorCode.DATA_CONFLICT;
        }
        ErrorCode code = BY_CONSTRAINT.get(constraintName);
        if (code == null) {
            log.warn("Unmapped constraint violation: {}", constraintName, ex);
            return ErrorCode.DATA_CONFLICT;
        }
        return code;
    }

    private String constraintNameOf(DataIntegrityViolationException ex) {
        if (ex.getCause() instanceof ConstraintViolationException cve) {
            return cve.getConstraintName();
        }
        return null;
    }
}
