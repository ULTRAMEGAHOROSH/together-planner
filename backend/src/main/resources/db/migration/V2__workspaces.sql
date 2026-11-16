CREATE TABLE workspace (
    id         uuid        NOT NULL,
    name       varchar(60) NOT NULL,
    time_zone  varchar(64) NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT pk_workspace PRIMARY KEY (id),
    CONSTRAINT ck_workspace_name CHECK (length(btrim(name)) > 0)
);

CREATE TABLE workspace_member (
    id           uuid        NOT NULL,
    workspace_id uuid        NOT NULL,
    user_id      uuid        NOT NULL,
    role         varchar(16) NOT NULL,
    seat         smallint    NOT NULL,         -- 1 = левая панель (создатель), 2 = правая
    joined_at    timestamptz NOT NULL,
    CONSTRAINT pk_workspace_member PRIMARY KEY (id),
    CONSTRAINT fk_member_workspace FOREIGN KEY (workspace_id) REFERENCES workspace (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT uq_member_workspace_user UNIQUE (workspace_id, user_id),
    CONSTRAINT uq_member_workspace_seat UNIQUE (workspace_id, seat),    -- не больше 2 участников
    CONSTRAINT uq_member_user UNIQUE (user_id),                         -- MVP: одно пространство на человека
    CONSTRAINT ck_member_role CHECK (role IN ('OWNER', 'MEMBER')),
    CONSTRAINT ck_member_seat CHECK (seat IN (1, 2))
);

CREATE TABLE workspace_invite (
    id           uuid        NOT NULL,
    workspace_id uuid        NOT NULL,
    code         varchar(16) NOT NULL,         -- без дефиса, UPPER CASE
    created_by   uuid        NOT NULL,
    created_at   timestamptz NOT NULL,
    expires_at   timestamptz NOT NULL,
    used_by      uuid,
    used_at      timestamptz,
    CONSTRAINT pk_workspace_invite PRIMARY KEY (id),
    CONSTRAINT uq_invite_code UNIQUE (code),
    CONSTRAINT fk_invite_workspace FOREIGN KEY (workspace_id) REFERENCES workspace (id) ON DELETE CASCADE,
    CONSTRAINT fk_invite_created_by FOREIGN KEY (created_by) REFERENCES app_user (id),
    CONSTRAINT fk_invite_used_by FOREIGN KEY (used_by) REFERENCES app_user (id),
    CONSTRAINT ck_invite_used CHECK ((used_by IS NULL) = (used_at IS NULL))
);
CREATE INDEX ix_invite_workspace ON workspace_invite (workspace_id);
