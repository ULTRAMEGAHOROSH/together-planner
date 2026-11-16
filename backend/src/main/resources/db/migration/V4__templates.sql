CREATE TABLE week_template (
    id           uuid         NOT NULL,
    workspace_id uuid         NOT NULL,
    name         varchar(60)  NOT NULL,
    description  varchar(500),
    created_by   uuid         NOT NULL,
    created_at   timestamptz  NOT NULL,
    updated_at   timestamptz  NOT NULL,
    version      bigint       NOT NULL DEFAULT 0,
    CONSTRAINT pk_week_template PRIMARY KEY (id),
    CONSTRAINT fk_template_workspace FOREIGN KEY (workspace_id) REFERENCES workspace (id) ON DELETE CASCADE,
    CONSTRAINT fk_template_created_by FOREIGN KEY (created_by) REFERENCES app_user (id),
    CONSTRAINT ck_template_name CHECK (length(btrim(name)) > 0)
);
CREATE UNIQUE INDEX uq_template_workspace_name ON week_template (workspace_id, lower(name));

CREATE TABLE template_event (
    id               uuid          NOT NULL,
    template_id      uuid          NOT NULL,
    title            varchar(100)  NOT NULL,
    description      varchar(2000),
    day_of_week      smallint      NOT NULL,      -- ISO: 1 = пн … 7 = вс
    start_time       time          NOT NULL,
    duration_minutes integer       NOT NULL,      -- «Сон 23:00 + 480 мин»
    category         varchar(16)   NOT NULL,
    color            varchar(16),
    CONSTRAINT pk_template_event PRIMARY KEY (id),
    CONSTRAINT fk_template_event_template FOREIGN KEY (template_id) REFERENCES week_template (id) ON DELETE CASCADE,
    CONSTRAINT ck_template_event_title CHECK (length(btrim(title)) > 0),
    CONSTRAINT ck_template_event_dow CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_template_event_duration CHECK (duration_minutes BETWEEN 1 AND 10080),
    CONSTRAINT ck_template_event_category CHECK (category IN
        ('WORK','SLEEP','FOOD','COMMUTE','SPORT','REST','TOGETHER','TRIP','OTHER')),
    CONSTRAINT ck_template_event_color CHECK (color IS NULL OR color IN
        ('WORK','SLEEP','FOOD','COMMUTE','SPORT','REST','TOGETHER','TRIP','OTHER'))
);
CREATE INDEX ix_template_event_template ON template_event (template_id);

CREATE TABLE template_event_participant (
    template_event_id uuid NOT NULL,
    user_id           uuid NOT NULL,
    CONSTRAINT pk_template_event_participant PRIMARY KEY (template_event_id, user_id),
    CONSTRAINT fk_tep_template_event FOREIGN KEY (template_event_id) REFERENCES template_event (id) ON DELETE CASCADE,
    CONSTRAINT fk_tep_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

CREATE TABLE template_application (
    id            uuid        NOT NULL,
    workspace_id  uuid        NOT NULL,
    template_id   uuid,                         -- NULL после удаления шаблона
    template_name varchar(60) NOT NULL,         -- снимок имени
    week_start    date        NOT NULL,
    mode          varchar(8)  NOT NULL,
    created_count integer     NOT NULL,
    skipped_count integer     NOT NULL,
    deleted_count integer     NOT NULL,
    applied_by    uuid        NOT NULL,
    applied_at    timestamptz NOT NULL,
    CONSTRAINT pk_template_application PRIMARY KEY (id),
    CONSTRAINT fk_application_workspace FOREIGN KEY (workspace_id) REFERENCES workspace (id) ON DELETE CASCADE,
    CONSTRAINT fk_application_template FOREIGN KEY (template_id) REFERENCES week_template (id) ON DELETE SET NULL,
    CONSTRAINT fk_application_applied_by FOREIGN KEY (applied_by) REFERENCES app_user (id),
    CONSTRAINT ck_application_mode CHECK (mode IN ('MERGE', 'FILL', 'REPLACE')),
    CONSTRAINT ck_application_monday CHECK (extract(isodow FROM week_start) = 1),
    CONSTRAINT ck_application_counts CHECK (created_count >= 0 AND skipped_count >= 0 AND deleted_count >= 0)
);
CREATE INDEX ix_application_workspace_week ON template_application (workspace_id, week_start);
CREATE INDEX ix_application_template ON template_application (template_id, applied_at DESC);

CREATE TABLE template_occurrence_exclusion (
    template_event_id uuid        NOT NULL,
    week_start        date        NOT NULL,
    created_by        uuid        NOT NULL,
    created_at        timestamptz NOT NULL,
    CONSTRAINT pk_template_occurrence_exclusion PRIMARY KEY (template_event_id, week_start),
    CONSTRAINT fk_exclusion_template_event FOREIGN KEY (template_event_id) REFERENCES template_event (id) ON DELETE CASCADE,
    CONSTRAINT fk_exclusion_created_by FOREIGN KEY (created_by) REFERENCES app_user (id),
    CONSTRAINT ck_exclusion_monday CHECK (extract(isodow FROM week_start) = 1)
);
