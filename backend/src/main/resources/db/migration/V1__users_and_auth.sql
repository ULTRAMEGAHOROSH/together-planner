CREATE TABLE app_user (
    id            uuid         NOT NULL,
    email         varchar(254) NOT NULL,
    display_name  varchar(50)  NOT NULL,
    password_hash varchar(100) NOT NULL,
    created_at    timestamptz  NOT NULL,
    updated_at    timestamptz  NOT NULL,
    CONSTRAINT pk_app_user PRIMARY KEY (id),
    CONSTRAINT uq_app_user_email UNIQUE (email),
    CONSTRAINT ck_app_user_email_lower CHECK (email = lower(email))
);

CREATE TABLE refresh_token (
    id            uuid        NOT NULL,
    user_id       uuid        NOT NULL,
    token_hash    char(64)    NOT NULL,          -- SHA-256 (hex); сам токен не хранится
    created_at    timestamptz NOT NULL,
    expires_at    timestamptz NOT NULL,
    revoked_at    timestamptz,
    revoke_reason varchar(16),
    CONSTRAINT pk_refresh_token PRIMARY KEY (id),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_token_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT ck_refresh_token_revoke CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL)),
    CONSTRAINT ck_refresh_token_reason CHECK (revoke_reason IS NULL OR
        revoke_reason IN ('ROTATED', 'LOGOUT', 'LOGOUT_ALL', 'REUSE_DETECTED'))
);
CREATE INDEX ix_refresh_token_user_active ON refresh_token (user_id) WHERE revoked_at IS NULL;
CREATE INDEX ix_refresh_token_expires ON refresh_token (expires_at);
