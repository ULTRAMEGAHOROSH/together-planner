CREATE TABLE event (
    id                       uuid          NOT NULL,
    workspace_id             uuid          NOT NULL,
    title                    varchar(100)  NOT NULL,
    description              varchar(2000),
    start_local              timestamp     NOT NULL,
    end_local                timestamp     NOT NULL,
    category                 varchar(16)   NOT NULL,
    color                    varchar(16),                  -- NULL = цвет категории
    source_template_event_id uuid,                         -- метка происхождения, БЕЗ FK
    source_week_start        date,
    source_template_name     varchar(60),                  -- снимок имени шаблона
    created_by               uuid          NOT NULL,
    updated_by               uuid          NOT NULL,
    created_at               timestamptz   NOT NULL,
    updated_at               timestamptz   NOT NULL,
    version                  bigint        NOT NULL DEFAULT 0,
    CONSTRAINT pk_event PRIMARY KEY (id),
    CONSTRAINT fk_event_workspace FOREIGN KEY (workspace_id) REFERENCES workspace (id) ON DELETE CASCADE,
    CONSTRAINT fk_event_created_by FOREIGN KEY (created_by) REFERENCES app_user (id),
    CONSTRAINT fk_event_updated_by FOREIGN KEY (updated_by) REFERENCES app_user (id),
    CONSTRAINT ck_event_title CHECK (length(btrim(title)) > 0),
    CONSTRAINT ck_event_time CHECK (end_local > start_local),
    CONSTRAINT ck_event_max_duration CHECK (end_local - start_local <= interval '31 days'),
    CONSTRAINT ck_event_category CHECK (category IN
        ('WORK','SLEEP','FOOD','COMMUTE','SPORT','REST','TOGETHER','TRIP','OTHER')),
    CONSTRAINT ck_event_color CHECK (color IS NULL OR color IN
        ('WORK','SLEEP','FOOD','COMMUTE','SPORT','REST','TOGETHER','TRIP','OTHER')),
    CONSTRAINT ck_event_source CHECK (
        (source_template_event_id IS NULL AND source_week_start IS NULL AND source_template_name IS NULL) OR
        (source_template_event_id IS NOT NULL AND source_week_start IS NOT NULL AND source_template_name IS NOT NULL)),
    CONSTRAINT ck_event_source_monday CHECK (source_week_start IS NULL OR extract(isodow FROM source_week_start) = 1)
);

CREATE INDEX ix_event_workspace_start ON event (workspace_id, start_local);

CREATE UNIQUE INDEX uq_event_template_source
    ON event (workspace_id, source_template_event_id, source_week_start)
    WHERE source_template_event_id IS NOT NULL;

CREATE TABLE event_participant (
    event_id uuid NOT NULL,
    user_id  uuid NOT NULL,
    CONSTRAINT pk_event_participant PRIMARY KEY (event_id, user_id),
    CONSTRAINT fk_event_participant_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT fk_event_participant_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);
CREATE INDEX ix_event_participant_user ON event_participant (user_id);
