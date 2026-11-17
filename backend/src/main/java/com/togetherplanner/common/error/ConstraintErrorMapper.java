package com.togetherplanner.common.error;

import lombok.extern.slf4j.Slf4j;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Last line of defense for races the service-level checks miss. The service
 * checks stay the fast path with a readable message; this maps a DB
 * constraint violation to the same error code the service would have used
 * had it caught the conflict first.
 *
 * <p>Once a constraint fails, the whole transaction is aborted - there's no
 * catching and retrying inside it, only failing the request.
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
