package com.togetherplanner.common.error;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

class ConstraintErrorMapperTest {

    private final ConstraintErrorMapper mapper = new ConstraintErrorMapper();

    @ParameterizedTest
    @CsvSource({
            "uq_app_user_email,          EMAIL_ALREADY_REGISTERED",
            "uq_member_user,             ALREADY_IN_WORKSPACE",
            "uq_member_workspace_user,   ALREADY_IN_WORKSPACE",
            "uq_member_workspace_seat,   WORKSPACE_FULL",
            "uq_template_workspace_name, TEMPLATE_NAME_TAKEN",
            "uq_event_template_source,   TEMPLATE_APPLY_CONFLICT",
    })
    void mapsEachKnownConstraintToItsCode(String constraintName, ErrorCode expected) {
        assertThat(mapper.map(violation(constraintName))).isEqualTo(expected);
    }

    @Test
    void unknownConstraintMapsToDataConflict() {
        assertThat(mapper.map(violation("uq_something_unrelated"))).isEqualTo(ErrorCode.DATA_CONFLICT);
    }

    @Test
    void missingConstraintNameMapsToDataConflict() {
        assertThat(mapper.map(violation(null))).isEqualTo(ErrorCode.DATA_CONFLICT);
    }

    @Test
    void nonHibernateCauseMapsToDataConflict() {
        var ex = new DataIntegrityViolationException("boom", new IllegalStateException("not a constraint violation"));
        assertThat(mapper.map(ex)).isEqualTo(ErrorCode.DATA_CONFLICT);
    }

    private DataIntegrityViolationException violation(String constraintName) {
        var cause = new ConstraintViolationException("duplicate key", new SQLException("duplicate"), constraintName);
        return new DataIntegrityViolationException("could not execute statement", cause);
    }
}
