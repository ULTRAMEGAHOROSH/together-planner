# Together Planner — спецификация backend (MVP)

Документ-ориентир для самостоятельной реализации backend: таблицы, поля, эндпоинты, DTO, коды ошибок и бизнес-правила.
Сверено с прототипом `Main.dc.html` (категории, режимы применения шаблона, поля события).

---

## 0. Принятые допущения

Открытые вопросы Этапа 0 решены по рекомендациям. Если решение поменяется — меняется только соответствующий раздел.

| Вопрос | Решение |
|---|---|
| Часовой пояс | Один IANA-пояс на пространство (`Asia/Almaty`). События хранятся в **локальном** времени (`timestamp without time zone` ↔ `LocalDateTime`) |
| `REPLACE` | Удаляет только события, созданные из шаблонов. Ручные — только при `includeManual = true` |
| Пространства | MVP: пользователь состоит максимум в одном пространстве, в пространстве максимум 2 участника |
| Spring Boot | Спецификация не зависит от версии. Рекомендуется 4.x, отличия от 3.5 — в разделе 10 |
| Точность времени | Минуты. Секунды и наносекунды обрезаются в сервисе (`truncatedTo(MINUTES)`) |

---

## 1. Соглашения API

- Базовый путь: `/api/v1`. Формат — JSON, UTF-8.
- Аутентификация: заголовок `Authorization: Bearer <accessToken>`. Refresh-токен — в cookie `tp_refresh`.
- ID — UUID (v7, генерирует приложение).
- Форматы времени в JSON:

| Java-тип | JSON | Пример |
|---|---|---|
| `LocalDate` | `yyyy-MM-dd` | `"2026-11-20"` |
| `LocalTime` | `HH:mm[:ss]` | `"08:00:00"` |
| `LocalDateTime` | ISO local, без смещения | `"2026-11-20T08:00:00"` |
| `Instant` | ISO UTC | `"2026-11-12T09:15:30Z"` |
| `DayOfWeek` | имя enum | `"MONDAY"` |

- Enum-ы сериализуются строкой в UPPER_CASE.
- Успешный ответ — сам DTO, без обёртки. Ошибка — `ProblemDetail` (раздел 6).
- Создание → `201 Created` + заголовок `Location`. Удаление → `204 No Content`.
- Пагинация: `?page=0&size=20` (`size` ≤ 100), ответ `PageResponse<T>`. Spring `Page` наружу не отдаём: его JSON не стабилен между версиями.
- Чужой или несуществующий ресурс → `404`. Никогда не `403`: не раскрываем, что UUID существует.

---

## 2. Структура пакетов

```
com.togetherplanner
├── TogetherPlannerApplication
├── common
│   ├── error      ErrorCode (enum), ApiException, GlobalExceptionHandler, FieldErrorResponse
│   ├── web        PageResponse<T>
│   └── time       TimeService (now в поясе, нормализация DST, расчёт недели)
├── config         ClockConfig, OpenApiConfig, JpaConfig
├── security       SecurityConfig, JwtConfig, JwtService, ProblemAuthenticationEntryPoint,
│                  ProblemAccessDeniedHandler, SecurityProperties (@ConfigurationProperties)
├── auth
│   ├── controller AuthController
│   ├── service    AuthService, RefreshTokenService
│   ├── repository RefreshTokenRepository
│   ├── entity     RefreshToken
│   └── dto        RegisterRequest, LoginRequest, AuthResponse, MeResponse
├── user
│   ├── service    UserService
│   ├── repository UserRepository
│   ├── entity     User
│   ├── dto        UserResponse
│   └── mapper     UserMapper
├── workspace
│   ├── controller WorkspaceController
│   ├── service    WorkspaceService, WorkspaceAccessService, InviteCodeGenerator
│   ├── repository WorkspaceRepository, WorkspaceMemberRepository, WorkspaceInviteRepository
│   ├── entity     Workspace, WorkspaceMember, WorkspaceInvite, WorkspaceRole
│   ├── dto        CreateWorkspaceRequest, UpdateWorkspaceRequest, JoinWorkspaceRequest,
│   │              WorkspaceResponse, MemberResponse, InviteResponse
│   └── mapper     WorkspaceMapper
├── event
│   ├── controller EventController
│   ├── service    EventService, EventValidator
│   ├── repository EventRepository
│   ├── entity     Event, EventSource (@Embeddable), EventCategory, EventColor
│   ├── dto        EventRequest, EventResponse, EventSourceResponse, NewTemplateEvent
│   └── mapper     EventMapper
├── template
│   ├── controller TemplateController, TemplateApplicationController
│   ├── service    TemplateService, TemplateApplyService, ApplyPlanner
│   ├── repository WeekTemplateRepository, TemplateApplicationRepository
│   ├── entity     WeekTemplate, TemplateEvent, TemplateApplication, ApplyMode
│   ├── dto        TemplateRequest, TemplateEventRequest, TemplateResponse, TemplateEventResponse,
│   │              ApplyTemplateRequest, ApplyPreviewResponse, PlannedEvent, ApplyConflict,
│   │              ApplyResultResponse, TemplateApplicationResponse
│   └── mapper     TemplateMapper
└── schedule
    ├── controller WeekController
    ├── service    WeekViewService
    └── dto        WeekResponse
```

### Правила зависимостей между модулями

```
schedule ─▶ event, template, workspace
template ─▶ event, workspace
event    ─▶ workspace
workspace ─▶ user
auth     ─▶ user
все      ─▶ common
```

1. **Другой модуль вызываем только через его сервис.** Репозитории и сущности чужого модуля не трогаем. `template` создаёт события через `EventService`, а не через `EventRepository`.
2. **Между модулями ссылаемся по ID, а не по сущности.** В `Event` поле `UUID workspaceId`, а не `@ManyToOne Workspace`. Граф сущностей не расползается по модулям, и модули не тянут друг друга при загрузке. `@OneToMany` / `@ManyToOne` — только внутри модуля (`WeekTemplate` → `TemplateEvent`).
3. **Сервисы принимают `UUID currentUserId` явным параметром**, а не читают `SecurityContext`. Контроллер достаёт его из JWT. Так сервис тестируется обычным unit-тестом.
4. **Первая строка любого метода сервиса под `/workspaces/{wsId}`** — `workspaceAccess.requireMember(wsId, userId)`.

---

## 3. База данных

### 3.1. Общие правила

- PK — `uuid`, генерируется в Java. На Hibernate 7 (Boot 4) — `@Id @UuidGenerator(style = UuidGenerator.Style.VERSION_7)`. На Hibernate 6 этого стиля может не быть: тогда обычный `@UuidGenerator` (случайный v4). Для MVP разница в производительности незаметна.
- `created_at` / `updated_at` — `timestamptz` ↔ `Instant`. Заполняются через `@CreationTimestamp` / `@UpdateTimestamp` или JPA auditing.
- Время событий — `timestamp` (без пояса) ↔ `LocalDateTime`.
- `hibernate.jdbc.time_zone: UTC`.
- Имена: `snake_case`. Constraint-ы: `pk_`, `fk_`, `uq_`, `ck_`, `ix_`.
- Схему меняет только Flyway (`spring.jpa.hibernate.ddl-auto: validate`).

### 3.2. Миграции

#### `V1__users_and_auth.sql`

```sql
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
    id          uuid        NOT NULL,
    user_id     uuid        NOT NULL,
    token_hash  char(64)    NOT NULL,          -- SHA-256 в hex; сам токен не храним
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    CONSTRAINT pk_refresh_token PRIMARY KEY (id),
    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_token_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
);
CREATE INDEX ix_refresh_token_user ON refresh_token (user_id);
```

#### `V2__workspaces.sql`

```sql
CREATE TABLE workspace (
    id         uuid        NOT NULL,
    name       varchar(60) NOT NULL,
    time_zone  varchar(64) NOT NULL,           -- IANA id, проверяется в Java через ZoneId.of
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CONSTRAINT pk_workspace PRIMARY KEY (id)
);

CREATE TABLE workspace_member (
    id           uuid        NOT NULL,
    workspace_id uuid        NOT NULL,
    user_id      uuid        NOT NULL,
    role         varchar(16) NOT NULL,
    joined_at    timestamptz NOT NULL,
    CONSTRAINT pk_workspace_member PRIMARY KEY (id),
    CONSTRAINT fk_member_workspace FOREIGN KEY (workspace_id) REFERENCES workspace (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT uq_member_workspace_user UNIQUE (workspace_id, user_id),
    CONSTRAINT uq_member_user UNIQUE (user_id),            -- MVP: одно пространство на человека
    CONSTRAINT ck_member_role CHECK (role IN ('OWNER', 'MEMBER'))
);

CREATE TABLE workspace_invite (
    id           uuid        NOT NULL,
    workspace_id uuid        NOT NULL,
    code         varchar(16) NOT NULL,         -- хранится без дефиса, UPPER CASE
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
```

`uq_member_workspace_user` сейчас избыточен рядом с `uq_member_user`. Его оставляем на будущее, когда разрешим несколько пространств: тогда удаляется только `uq_member_user`.

#### `V3__events.sql`

```sql
CREATE TABLE event (
    id                       uuid          NOT NULL,
    workspace_id             uuid          NOT NULL,
    title                    varchar(100)  NOT NULL,
    description              varchar(2000),
    start_local              timestamp     NOT NULL,
    end_local                timestamp     NOT NULL,
    category                 varchar(16)   NOT NULL,
    color                    varchar(16),                  -- NULL = цвет категории
    source_template_event_id uuid,                         -- происхождение из шаблона (без FK!)
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

-- Главная защита от дублей при повторном применении шаблона
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
```

**Зачем ограничение в 31 день.** Выборка недели ищет пересечения: `start < :to AND end > :from`. Индекс по `start_local` для такого условия сам по себе плохо сужает диапазон. Раз событие не длиннее 31 дня, в запрос можно добавить `start_local >= :from - 31 day`, и индекс отработает как обычный диапазонный поиск.

**Цвет** — ключ палитры, а не hex. В прототипе пользователь выбирает «цвет как у категории X». Палитру (bg / fg / dot) хранит frontend.

#### `V4__templates.sql`

```sql
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
    day_of_week      smallint      NOT NULL,      -- ISO: 1 = понедельник … 7 = воскресенье
    start_time       time          NOT NULL,
    duration_minutes integer       NOT NULL,      -- вместо end_time: «Сон 23:00 + 480 мин»
    category         varchar(16)   NOT NULL,
    color            varchar(16),
    CONSTRAINT pk_template_event PRIMARY KEY (id),
    CONSTRAINT fk_template_event_template FOREIGN KEY (template_id) REFERENCES week_template (id) ON DELETE CASCADE,
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
    template_id   uuid,                         -- NULL, если шаблон потом удалили
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
    CONSTRAINT ck_application_monday CHECK (extract(isodow FROM week_start) = 1)
);
CREATE INDEX ix_application_workspace_week ON template_application (workspace_id, week_start);
CREATE INDEX ix_application_template ON template_application (template_id, applied_at DESC);
```

**Почему у `event.source_template_event_id` нет FK.** Это метка происхождения, а не связь. Событие — независимая копия: шаблон и его события можно менять и удалять, на созданные события это не влияет. Метка нужна только для защиты от дублей и для режима `REPLACE`.

### 3.3. Маппинг сущностей (JPA)

| Сущность | Ключевые моменты |
|---|---|
| `User` | `email` нормализуется в сервисе: `trim().toLowerCase(Locale.ROOT)` |
| `RefreshToken` | `UUID userId` (не `@ManyToOne`) |
| `Workspace` | `ZoneId timeZone` через `AttributeConverter<ZoneId, String>`, или храним `String` и отдаём `ZoneId` из getter |
| `WorkspaceMember` | `UUID workspaceId`, `UUID userId`, `@Enumerated(STRING) WorkspaceRole role`. Внутри модуля можно и `@ManyToOne Workspace` — на ваш выбор |
| `WorkspaceInvite` | `UUID workspaceId`, `code`, `expiresAt`, `usedBy`, `usedAt` |
| `Event` | `UUID workspaceId`; `LocalDateTime startLocal/endLocal`; `@Enumerated(STRING) category`, `color`; `@Embedded EventSource source` (nullable); `@Version long version`; участники — `@ElementCollection` (ниже) |
| `EventSource` | `@Embeddable`: `templateEventId`, `weekStart`, `templateName` |
| `WeekTemplate` | `@OneToMany(mappedBy = "template", cascade = ALL, orphanRemoval = true) List<TemplateEvent> events`; `@Version` |
| `TemplateEvent` | `@ManyToOne(fetch = LAZY) WeekTemplate template`; `DayOfWeek dayOfWeek` через converter в `smallint` (`getValue()` / `DayOfWeek.of()`); `LocalTime startTime`; `int durationMinutes`; участники — `@ElementCollection` |
| `TemplateApplication` | `UUID templateId` (nullable), `@Enumerated(STRING) ApplyMode mode` |

Участников храним как множество UUID, без загрузки сущностей `User`:

```java
@ElementCollection
@CollectionTable(name = "event_participant", joinColumns = @JoinColumn(name = "event_id"))
@Column(name = "user_id", nullable = false)
private Set<UUID> participantIds = new HashSet<>();
```

**Lombok в сущностях:** только `@Getter`, `@Setter`, `@NoArgsConstructor(access = PROTECTED)`. **Никогда** `@Data`, `@EqualsAndHashCode`, `@ToString` с коллекциями. `equals` / `hashCode` по `id`, где `hashCode` возвращает константу класса — стандартный приём для сущностей с id, генерируемым до persist.

**N+1 при загрузке участников.** В `application.yml` задаём `spring.jpa.properties.hibernate.default_batch_fetch_size: 50`. Тогда участники N событий грузятся пачками по 50 (1–2 запроса), без `JOIN FETCH`. Это важно для страничных запросов: `JOIN FETCH` коллекции вместе с пагинацией Hibernate выполняет в памяти и пишет предупреждение HHH90003004.

### 3.4. Enum-ы

```java
public enum WorkspaceRole { OWNER, MEMBER }

public enum EventCategory { WORK, SLEEP, FOOD, COMMUTE, SPORT, REST, TOGETHER, TRIP, OTHER }

// Ключ палитры; тот же набор значений, что у категорий. null = цвет категории.
public enum EventColor { WORK, SLEEP, FOOD, COMMUTE, SPORT, REST, TOGETHER, TRIP, OTHER }

public enum ApplyMode { MERGE, FILL, REPLACE }
```

| Категория | Подпись в UI |
|---|---|
| WORK | Работа |
| SLEEP | Сон |
| FOOD | Еда |
| COMMUTE | Дорога |
| SPORT | Спорт |
| REST | Отдых |
| TOGETHER | Вместе |
| TRIP | Поездка |
| OTHER | Другое |

---

## 4. Эндпоинты — сводка

| # | Метод | Путь | Доступ | Запрос | Ответ |
|---|---|---|---|---|---|
| A1 | POST | `/auth/register` | public | `RegisterRequest` | `201 AuthResponse` + cookie |
| A2 | POST | `/auth/login` | public | `LoginRequest` | `200 AuthResponse` + cookie |
| A3 | POST | `/auth/refresh` | cookie | — | `200 AuthResponse` + новая cookie |
| A4 | POST | `/auth/logout` | cookie | — | `204` |
| A5 | GET | `/auth/me` | bearer | — | `200 MeResponse` |
| W1 | POST | `/workspaces` | bearer | `CreateWorkspaceRequest` | `201 WorkspaceResponse` |
| W2 | GET | `/workspaces/current` | bearer | — | `200 WorkspaceResponse` |
| W3 | PATCH | `/workspaces/{wsId}` | member | `UpdateWorkspaceRequest` | `200 WorkspaceResponse` |
| W4 | GET | `/workspaces/{wsId}/members` | member | — | `200 List<MemberResponse>` |
| W5 | POST | `/workspaces/{wsId}/invites` | member | — | `201 InviteResponse` |
| W6 | POST | `/workspaces/join` | bearer | `JoinWorkspaceRequest` | `200 WorkspaceResponse` |
| S1 | GET | `/workspaces/{wsId}/week?date=` | member | — | `200 WeekResponse` |
| E1 | GET | `/workspaces/{wsId}/events?from=&to=` | member | — | `200 List<EventResponse>` |
| E2 | GET | `/workspaces/{wsId}/events/upcoming?page=&size=` | member | — | `200 PageResponse<EventResponse>` |
| E3 | POST | `/workspaces/{wsId}/events` | member | `EventRequest` | `201 EventResponse` |
| E4 | GET | `/workspaces/{wsId}/events/{eventId}` | member | — | `200 EventResponse` |
| E5 | PUT | `/workspaces/{wsId}/events/{eventId}` | member | `EventRequest` (+ `version`) | `200 EventResponse` |
| E6 | DELETE | `/workspaces/{wsId}/events/{eventId}` | member | — | `204` |
| T1 | GET | `/workspaces/{wsId}/templates` | member | — | `200 List<TemplateResponse>` |
| T2 | POST | `/workspaces/{wsId}/templates` | member | `TemplateRequest` | `201 TemplateResponse` |
| T3 | GET | `/workspaces/{wsId}/templates/{templateId}` | member | — | `200 TemplateResponse` |
| T4 | PUT | `/workspaces/{wsId}/templates/{templateId}` | member | `TemplateRequest` (+ `version`) | `200 TemplateResponse` |
| T5 | DELETE | `/workspaces/{wsId}/templates/{templateId}` | member | — | `204` |
| T6 | POST | `/workspaces/{wsId}/templates/{templateId}/apply/preview` | member | `ApplyTemplateRequest` | `200 ApplyPreviewResponse` |
| T7 | POST | `/workspaces/{wsId}/templates/{templateId}/apply` | member | `ApplyTemplateRequest` | `200 ApplyResultResponse` |
| T8 | GET | `/workspaces/{wsId}/template-applications?page=&size=` | member | — | `200 PageResponse<TemplateApplicationResponse>` |

Доступ: **public** — без токена; **bearer** — любой залогиненный; **member** — залогиненный участник `{wsId}`, иначе `404 WORKSPACE_NOT_FOUND`.

---

## 5. Эндпоинты — детально, с DTO

Все DTO — `record`. Аннотации валидации — `jakarta.validation.constraints.*`.

### 5.1. Общие DTO

```java
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext
) {
    public static <T> PageResponse<T> of(Page<T> p) { /* … */ }
}

public record UserResponse(UUID id, String email, String displayName, Instant createdAt) {}

public record MemberResponse(
        UUID userId,
        String displayName,
        WorkspaceRole role,
        Instant joinedAt
) {}
```

`members` всегда отсортированы по `joinedAt`. Frontend берёт первого для левой панели, второго — для правой.

### 5.2. Auth

#### A1. `POST /auth/register`

```java
public record RegisterRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72) String password,     // 72 — предел BCrypt в байтах
        @NotBlank @Size(max = 50) String displayName
) {}

public record AuthResponse(
        String accessToken,
        String tokenType,        // всегда "Bearer"
        long expiresIn,          // секунды до истечения access-токена
        UserResponse user
) {}
```

- `201` + `AuthResponse` + `Set-Cookie: tp_refresh=…`.
- Ошибки: `400 VALIDATION_FAILED`, `409 EMAIL_ALREADY_REGISTERED`.
- Правила: email нормализуется (trim + lower). Пароль → `PasswordEncoder.encode`. Сразу выдаётся пара токенов.

#### A2. `POST /auth/login`

```java
public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
```

- `200` + `AuthResponse` + cookie.
- `401 INVALID_CREDENTIALS` — и при неверном email, и при неверном пароле (одна и та же ошибка).

#### A3. `POST /auth/refresh`

- Тела нет. Читает cookie `tp_refresh`.
- `200` + `AuthResponse` + **новая** cookie (ротация).
- `401 REFRESH_TOKEN_INVALID` — cookie нет, токен не найден, истёк или отозван.
- Алгоритм в разделе 7.4.

#### A4. `POST /auth/logout`

- Работает без access-токена (он мог истечь). Отзывает refresh из cookie, если он есть, и очищает cookie (`Max-Age=0`).
- Всегда `204`.

#### A5. `GET /auth/me`

```java
public record MeResponse(UserResponse user, WorkspaceResponse workspace /* null, если ещё нет */) {}
```

Frontend: `workspace == null` → экран onboarding.

#### Cookie `tp_refresh`

```
tp_refresh=<base64url(32 случайных байта)>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=2592000
```

Собирается через `ResponseCookie.from(...)`. Флаг `Secure` настраивается через конфиг: на `http://localhost` Chrome его принимает, но для других клиентов может понадобиться отключить.

### 5.3. Workspace

```java
public record CreateWorkspaceRequest(
        @NotBlank @Size(max = 60) String name,
        @NotBlank @Size(max = 64) String timeZone          // проверка ZoneId.of → 400 INVALID_TIME_ZONE
) {}

public record UpdateWorkspaceRequest(
        @Size(min = 1, max = 60) String name,              // null = не менять
        @Size(max = 64) String timeZone                    // null = не менять
) {}

public record JoinWorkspaceRequest(@NotBlank @Size(max = 20) String code) {}

public record WorkspaceResponse(
        UUID id,
        String name,
        String timeZone,
        List<MemberResponse> members,
        Instant createdAt
) {}

public record InviteResponse(
        String code,             // "K7QM2XPA" — для API
        String displayCode,      // "K7QM-2XPA" — для показа человеку
        Instant expiresAt
) {}
```

| # | Успех | Ошибки | Правила |
|---|---|---|---|
| W1 | `201` | `409 ALREADY_IN_WORKSPACE`, `400 INVALID_TIME_ZONE` | Создатель становится `OWNER` |
| W2 | `200` | `404 WORKSPACE_NOT_FOUND` | Пространство текущего пользователя |
| W3 | `200` | `400 INVALID_TIME_ZONE` | Смена пояса **не сдвигает** события: они хранятся по местным часам |
| W4 | `200` | — | Сортировка по `joinedAt` |
| W5 | `201` | `409 WORKSPACE_FULL` | Код из 8 символов, живёт 7 дней. Прежние неиспользованные коды этого пространства удаляются |
| W6 | `200` | `404 INVITE_NOT_FOUND`, `409 INVITE_EXPIRED`, `409 INVITE_ALREADY_USED`, `409 WORKSPACE_FULL`, `409 ALREADY_IN_WORKSPACE` | Алгоритм в разделе 7.3 |

Ссылку-приглашение (`https://…/join?code=K7QM2XPA`) собирает frontend: backend не знает адрес frontend.

### 5.4. Неделя (модуль `schedule`)

#### S1. `GET /workspaces/{wsId}/week?date=2026-11-11`

`date` необязателен. По умолчанию — «сегодня» в поясе пространства. Любая дата приводится к понедельнику своей недели.

```java
public record WeekResponse(
        LocalDate weekStart,                                // понедельник
        LocalDate weekEnd,                                  // воскресенье (включительно)
        String timeZone,
        List<MemberResponse> members,
        List<EventResponse> events,                         // все, что пересекают неделю, по start
        List<TemplateApplicationResponse> appliedTemplates  // применения к этой неделе, по applied_at
) {}
```

В неделю попадают события, пересекающие интервал `[weekStart 00:00; weekStart + 7 дней 00:00)`. Например, «Сон» вс 23:00 – пн 07:00 попадёт в обе недели. Обрезку по границам делает frontend.

### 5.5. События

```java
public record EventRequest(
        @NotBlank @Size(max = 100) String title,
        @Size(max = 2000) String description,
        @NotNull LocalDateTime start,
        @NotNull LocalDateTime end,
        @NotEmpty @Size(max = 2) Set<@NotNull UUID> participantIds,
        @NotNull EventCategory category,
        EventColor color,                                   // null = цвет категории
        Long version                                        // обязателен только в PUT
) {}

public record EventResponse(
        UUID id,
        String title,
        String description,
        LocalDateTime start,
        LocalDateTime end,
        Set<UUID> participantIds,
        EventCategory category,
        EventColor color,
        EventSourceResponse source,                         // null, если создано вручную
        UUID createdBy,
        UUID updatedBy,
        Instant createdAt,
        Instant updatedAt,
        long version
) {}

public record EventSourceResponse(
        UUID templateEventId,
        LocalDate weekStart,
        String templateName                                 // «Создано из шаблона «Обычная неделя»»
) {}
```

**Почему один `EventRequest` на POST и PUT.** Отдельный `UpdateEventRequest` повторил бы 7 полей. Группы валидации (`groups = OnUpdate.class`) для такой мелочи — лишняя сложность. Поэтому в PUT сервис проверяет `version != null`, иначе `400 VERSION_REQUIRED`.

#### Правила события (`EventValidator`, общий для создания, изменения и шаблонов)

1. `title` после `trim()` не пустой (иначе `400 VALIDATION_FAILED`).
2. `start` и `end` обрезаются до минут. Затем нормализуются через пояс: несуществующее время в ночь перевода часов сдвигается вперёд (раздел 7.1).
3. `end > start`, иначе `400 EVENT_END_NOT_AFTER_START`. Переход через полночь разрешён: `end` просто на другую дату.
4. `end - start ≤ 31 день`, иначе `400 EVENT_TOO_LONG`.
5. Год `start` в диапазоне 2000–2100, иначе `400 EVENT_DATE_OUT_OF_RANGE`.
6. Каждый `participantId` — участник этого пространства, иначе `400 EVENT_PARTICIPANT_NOT_MEMBER`.
7. События в прошлом разрешены.

| # | Успех | Ошибки | Правила |
|---|---|---|---|
| E1 | `200`, сортировка по `start` | `400 INVALID_DATE_RANGE` (`to < from` или диапазон > 93 дней) | `from`/`to` — `LocalDate` включительно → пересечения с `[from 00:00; to + 1 день 00:00)`. Используется календарём на месяц |
| E2 | `200` | `400 VALIDATION_FAILED` (`size` > 100) | `end_local > now` (now в поясе пространства), сортировка `start_local, id` |
| E3 | `201` + `Location` | `400 …` (правила выше) | `source = null`; `createdBy = updatedBy = текущий` |
| E4 | `200` | `404 EVENT_NOT_FOUND` | `findByIdAndWorkspaceId` |
| E5 | `200` | `404 EVENT_NOT_FOUND`, `400 VERSION_REQUIRED`, `409 VERSION_CONFLICT`, `400 …` | **`source` не меняется**: событие из шаблона после правки остаётся «из шаблона», поэтому повторное применение его не продублирует |
| E6 | `204` | `404 EVENT_NOT_FOUND` | Удаление физическое. Если событие было из шаблона, повторный `MERGE` создаст его снова — это ожидаемо, ведь пользователь явно применяет шаблон ещё раз |

### 5.6. Шаблоны

```java
public record TemplateRequest(
        @NotBlank @Size(max = 60) String name,
        @Size(max = 500) String description,
        @NotNull @Size(max = 300) List<@Valid @NotNull TemplateEventRequest> events,
        Long version                                         // обязателен только в PUT
) {}

public record TemplateEventRequest(
        UUID id,                                             // null = новое; иначе id существующего
        @NotBlank @Size(max = 100) String title,
        @Size(max = 2000) String description,
        @NotNull DayOfWeek dayOfWeek,
        @NotNull LocalTime startTime,
        @Min(1) @Max(10080) int durationMinutes,
        @NotEmpty @Size(max = 2) Set<@NotNull UUID> participantIds,
        @NotNull EventCategory category,
        EventColor color
) {}

public record TemplateResponse(
        UUID id,
        String name,
        String description,
        List<TemplateEventResponse> events,                  // по dayOfWeek, startTime
        TemplateApplicationResponse lastApplication,         // null, если не применялся
        Instant createdAt,
        Instant updatedAt,
        long version
) {}

public record TemplateEventResponse(
        UUID id,
        String title,
        String description,
        DayOfWeek dayOfWeek,
        LocalTime startTime,
        int durationMinutes,
        Set<UUID> participantIds,
        EventCategory category,
        EventColor color
) {}
```

**T1 отдаёт шаблоны целиком, с событиями.** Карточкам в прототипе нужны мини-превью недели и счётчики (A / B / вместе). Шаблонов единицы, отдельный summary-DTO не окупается. Счётчики frontend считает сам.

| # | Успех | Ошибки | Правила |
|---|---|---|---|
| T1 | `200` | — | Сортировка по `name` |
| T2 | `201` | `409 TEMPLATE_NAME_TAKEN`, `400 EVENT_PARTICIPANT_NOT_MEMBER`, `400 VALIDATION_FAILED` | `id` в событиях должны быть `null` |
| T3 | `200` | `404 TEMPLATE_NOT_FOUND` | |
| T4 | `200` | `404 TEMPLATE_NOT_FOUND`, `400 VERSION_REQUIRED`, `409 VERSION_CONFLICT`, `409 TEMPLATE_NAME_TAKEN`, `400 TEMPLATE_EVENT_NOT_FOUND` | **Diff по id**, см. ниже |
| T5 | `204` | `404 TEMPLATE_NOT_FOUND` | Созданные события остаются. В истории `template_id` становится NULL, имя сохраняется |

**T4: обновление событий шаблона по id.** Список из запроса — полное новое состояние, но применяется как diff:

- `id` есть в шаблоне → обновить поля **этой же строки**;
- `id == null` → создать новую;
- есть в шаблоне, но нет в запросе → удалить (`orphanRemoval`);
- `id` не принадлежит этому шаблону → `400 TEMPLATE_EVENT_NOT_FOUND`.

Почему это критично: если пересоздавать все события шаблона с новыми id, защита от дублей по `source_template_event_id` перестанет работать.

### 5.7. Применение шаблона

```java
public record ApplyTemplateRequest(
        @NotNull LocalDate weekStart,          // обязан быть понедельником → иначе 400 WEEK_START_NOT_MONDAY
        @NotNull ApplyMode mode,
        boolean includeManual                  // учитывается только при REPLACE
) {}

public record PlannedEvent(
        UUID templateEventId,
        String title,
        LocalDateTime start,
        LocalDateTime end,
        Set<UUID> participantIds,
        EventCategory category,
        EventColor color
) {}

public record ApplyConflict(PlannedEvent planned, EventResponse existing) {}

public record ApplyPreviewResponse(
        LocalDate weekStart,
        ApplyMode mode,
        List<PlannedEvent> toCreate,
        List<PlannedEvent> skippedAlreadyApplied,   // уже созданы из этого шаблона в эту неделю
        List<PlannedEvent> skippedBusy,             // только FILL: у участника день занят
        List<ApplyConflict> conflicts,              // будут созданы, но пересекаются — предупреждение
        List<EventResponse> toDelete,               // только REPLACE
        int manualEventsInWeek                      // для подсказки «ручные события останутся»
) {}

public record TemplateApplicationResponse(
        UUID id,
        UUID templateId,                            // null, если шаблон удалён
        String templateName,
        LocalDate weekStart,
        ApplyMode mode,
        int createdCount,
        int skippedCount,
        int deletedCount,
        UUID appliedBy,
        Instant appliedAt
) {}

public record ApplyResultResponse(
        TemplateApplicationResponse application,
        List<EventResponse> createdEvents
) {}
```

| # | Успех | Ошибки |
|---|---|---|
| T6 | `200`, ничего не меняет | `404 TEMPLATE_NOT_FOUND`, `400 WEEK_START_NOT_MONDAY` |
| T7 | `200` | те же + `409 TEMPLATE_APPLY_CONFLICT` (сработал уникальный индекс в гонке) |
| T8 | `200`, сортировка `applied_at DESC` | — |

**T6 и T7 вызывают один и тот же `ApplyPlanner.plan(...)`.** T7 планирует заново и выполняет план в одной транзакции. Если между предпросмотром и применением что-то изменилось, применится актуальный план, а не устаревший. Алгоритм — в разделе 7.5.

T7 создаёт запись в `template_application` всегда, даже если создано 0 событий: это честная история действий.

---

## 6. Ошибки

### 6.1. Формат (RFC 9457 `ProblemDetail`)

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Время окончания должно быть позже времени начала",
  "instance": "/api/v1/workspaces/0193…/events",
  "code": "EVENT_END_NOT_AFTER_START",
  "errors": [
    { "field": "end", "message": "must be after start" }
  ]
}
```

`code` и `errors` — дополнительные свойства (`problemDetail.setProperty(...)`). `errors` заполняется только для ошибок валидации полей.

### 6.2. Реализация

```java
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    VALIDATION_FAILED(BAD_REQUEST),
    // …
    ;
    private final HttpStatus status;
}

public class ApiException extends RuntimeException {
    private final ErrorCode code;
    public ApiException(ErrorCode code, String detail) { super(detail); this.code = code; }
}
```

Одно исключение и enum, в котором у каждого кода свой HTTP-статус. Иерархия `NotFoundException` / `ConflictException` не нужна: статус уже в коде.

`GlobalExceptionHandler extends ResponseEntityExceptionHandler`:

| Исключение | Ответ |
|---|---|
| `ApiException` | `code.status`, `code` |
| `MethodArgumentNotValidException` (переопределить `handleMethodArgumentNotValid`) | `400 VALIDATION_FAILED` + `errors[]` |
| `HandlerMethodValidationException`, `ConstraintViolationException` | `400 VALIDATION_FAILED` |
| `HttpMessageNotReadableException` (кривой JSON, неизвестный enum, неверная дата) | `400 MALFORMED_REQUEST` |
| `MethodArgumentTypeMismatchException` (кривой UUID в пути) | `400 MALFORMED_REQUEST` |
| `ObjectOptimisticLockingFailureException` | `409 VERSION_CONFLICT` |
| `DataIntegrityViolationException` | `409 DATA_CONFLICT` (логировать) |
| `Exception` | `500 INTERNAL_ERROR`, без stacktrace в ответе, с логом `error` |

**Важно:** `401` и `403` из Spring Security формируются в фильтрах **до** контроллеров, и `@RestControllerAdvice` их не ловит. Нужны свои `AuthenticationEntryPoint` → `401 UNAUTHORIZED` и `AccessDeniedHandler` → `403 FORBIDDEN`, которые пишут тот же формат `ProblemDetail`.

### 6.3. Каталог кодов

| Код | HTTP | Когда |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Bean Validation |
| `MALFORMED_REQUEST` | 400 | Нечитаемый JSON или параметр |
| `INVALID_TIME_ZONE` | 400 | `ZoneId.of` упал |
| `INVALID_DATE_RANGE` | 400 | E1: `to < from` или > 93 дней |
| `EVENT_END_NOT_AFTER_START` | 400 | |
| `EVENT_TOO_LONG` | 400 | > 31 дня |
| `EVENT_DATE_OUT_OF_RANGE` | 400 | Год вне 2000–2100 |
| `EVENT_PARTICIPANT_NOT_MEMBER` | 400 | Участник не из пространства |
| `VERSION_REQUIRED` | 400 | PUT без `version` |
| `WEEK_START_NOT_MONDAY` | 400 | |
| `TEMPLATE_EVENT_NOT_FOUND` | 400 | T4: чужой `id` события шаблона |
| `UNAUTHORIZED` | 401 | Нет или неверный access-токен |
| `INVALID_CREDENTIALS` | 401 | Логин |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh |
| `FORBIDDEN` | 403 | Зарезервирован (в MVP почти не используется) |
| `WORKSPACE_NOT_FOUND` | 404 | Нет пространства или пользователь не участник |
| `INVITE_NOT_FOUND` | 404 | |
| `EVENT_NOT_FOUND` | 404 | |
| `TEMPLATE_NOT_FOUND` | 404 | |
| `EMAIL_ALREADY_REGISTERED` | 409 | |
| `ALREADY_IN_WORKSPACE` | 409 | |
| `WORKSPACE_FULL` | 409 | Уже 2 участника |
| `INVITE_EXPIRED` | 409 | |
| `INVITE_ALREADY_USED` | 409 | |
| `TEMPLATE_NAME_TAKEN` | 409 | |
| `VERSION_CONFLICT` | 409 | Кто-то изменил раньше |
| `TEMPLATE_APPLY_CONFLICT` | 409 | Гонка при применении |
| `DATA_CONFLICT` | 409 | Прочие нарушения ограничений БД |
| `INTERNAL_ERROR` | 500 | |

---

## 7. Бизнес-логика и алгоритмы

### 7.1. Время (`TimeService`)

```java
// неделя
LocalDate weekStart(LocalDate anyDate) = anyDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

// «сейчас» в поясе пространства — только через инжектированный Clock
LocalDateTime now(ZoneId zone)        = LocalDateTime.now(clock.withZone(zone));
LocalDate     today(ZoneId zone)      = LocalDate.now(clock.withZone(zone));

// нормализация: несуществующее время (переход вперёд) сдвигается вперёд,
// двусмысленное (переход назад) берёт более раннее смещение
LocalDateTime normalize(LocalDateTime t, ZoneId zone) = ZonedDateTime.of(t, zone).toLocalDateTime();
```

`Clock` — бин (`Clock.systemUTC()`). В тестах подменяется на `Clock.fixed(...)`.

### 7.2. Проверка доступа (`WorkspaceAccessService`)

```java
public void requireMember(UUID workspaceId, UUID userId) {
    if (!memberRepository.existsByWorkspaceIdAndUserId(workspaceId, userId)) {
        throw new ApiException(WORKSPACE_NOT_FOUND, "Workspace not found");
    }
}
public ZoneId zoneOf(UUID workspaceId) { … }
public Set<UUID> memberIds(UUID workspaceId) { … }          // для проверки participantIds
public void lockForUpdate(UUID workspaceId) { … }           // @Lock(PESSIMISTIC_WRITE) findById
```

Затем каждый ресурс ищется **вместе с `workspaceId`**: `eventRepository.findByIdAndWorkspaceId(eventId, wsId)`. Даже если кто-то подставит UUID чужого события в свой `wsId`, запрос вернёт пусто → 404.

### 7.3. Присоединение по коду (W6)

```
@Transactional
1. code = normalize(request.code)       // UPPER, убрать '-', пробелы
2. invite = inviteRepo.findByCode(code)              → нет: 404 INVITE_NOT_FOUND
3. если пользователь уже где-то участник             → 409 ALREADY_IN_WORKSPACE
4. workspaceAccess.lockForUpdate(invite.workspaceId) // SELECT … FOR UPDATE — сериализует параллельные join
5. invite.usedAt != null                             → 409 INVITE_ALREADY_USED
6. invite.expiresAt < now                            → 409 INVITE_EXPIRED
7. count(members) >= 2                               → 409 WORKSPACE_FULL
8. сохранить WorkspaceMember(role = MEMBER); invite.usedBy/usedAt = текущий/now
```

Генерация кода: `SecureRandom`, алфавит `23456789ABCDEFGHJKMNPQRSTVWXYZ` (без похожих 0/O, 1/I/L), 8 символов. При коллизии (нарушение `uq_invite_code`) — повторить до 3 раз.

### 7.4. Refresh-токены

**Выдача:** `raw = base64url(32 байта SecureRandom)` → в БД `sha256hex(raw)`, `expiresAt = now + 30d` → `raw` уходит в cookie.

**Обновление (A3):**

```
@Transactional
1. hash = sha256hex(cookie)
2. token = repo.findByTokenHash(hash)              → нет: 401
3. token.revokedAt != null                         → ПОВТОРНОЕ ИСПОЛЬЗОВАНИЕ = вероятная кража:
                                                     отозвать все активные токены пользователя, 401
4. token.expiresAt < now                           → 401
5. token.revokedAt = now; выдать новый refresh + новый access
```

**Access JWT:** HS256, секрет из `JWT_SECRET` (≥ 32 байта, base64). Claims: `iss = together-planner`, `sub = userId`, `iat`, `exp = iat + 15 min`. Пространства в токене **нет**: членство проверяется по БД на каждый запрос, поэтому изменения действуют сразу.

**Spring Security:**

- `oauth2ResourceServer(jwt)`, `NimbusJwtEncoder(new ImmutableSecret<>(key))`, `NimbusJwtDecoder.withSecretKey(key).macAlgorithm(HS256)`.
- `sessionCreationPolicy(STATELESS)`, `csrf.disable()`. Refresh-cookie защищена `SameSite=Strict` и узким `Path`.
- `permitAll`: `/api/v1/auth/register|login|refresh|logout`, `/v3/api-docs/**`, `/swagger-ui/**`, `/actuator/health`. Остальное — `authenticated()`.
- В контроллере: `@AuthenticationPrincipal Jwt jwt` → `UUID.fromString(jwt.getSubject())`. Можно завернуть в свою аннотацию `@CurrentUserId UUID userId` через `HandlerMethodArgumentResolver`.

### 7.5. Применение шаблона (`ApplyPlanner` + `TemplateApplyService`)

Перевод события шаблона в конкретную неделю (materialize):

```
start = normalize(weekStart.plusDays(dayOfWeek.getValue() - 1).atTime(startTime), zone)
end   = start.plusMinutes(durationMinutes)
```

Например, «Сон» вс 23:00 + 480 мин даёт событие пн 07:00 **следующей** недели. Его `source_week_start` всё равно равен этой неделе.

`plan(wsId, template, weekStart, mode, includeManual)`:

```
weekFrom = weekStart.atStartOfDay(); weekTo = weekFrom.plusDays(7)
existing = события пространства, пересекающие неделю (+ сдвиг на «хвосты» прошлой недели)

1. toDelete = mode == REPLACE
       ? existing.filter(e -> startInWeek(e) && (e.source != null || includeManual))
       : []
2. remaining = existing − toDelete
3. для каждого te в template.events:
     m = materialize(te)
     a) remaining.any(e -> e.source?.templateEventId == te.id && e.source.weekStart == weekStart)
            → skippedAlreadyApplied; continue
     b) mode == FILL && remaining.any(e -> e.start.toLocalDate() == m.start.toLocalDate()
                                        && shareParticipant(e, m))
            → skippedBusy; continue
     c) hit = remaining.find(e -> shareParticipant(e, m) && overlaps(e, m))
            если hit → conflicts += (m, hit)          // только предупреждение
     d) toCreate += m
```

- `overlaps(a, b) = a.start < b.end && a.end > b.start`.
- `shareParticipant` — пересечение множеств `participantIds` не пустое.
- Правило FILL: событие не добавляется, если **хотя бы у одного** его участника в этот день уже есть событие, *начинающееся* в этот день.

`apply(...)`:

```
@Transactional
1. workspaceAccess.requireMember; workspaceAccess.lockForUpdate(wsId)   // два применения в одном пространстве идут по очереди
2. plan = planner.plan(...)
3. eventService.deleteByIds(wsId, ids(plan.toDelete))
4. created = eventService.createFromTemplate(wsId, userId, plan.toCreate, source(te.id, weekStart, template.name))
5. сохранить TemplateApplication(counts…)
6. вернуть ApplyResultResponse
DataIntegrityViolation на uq_event_template_source → 409 TEMPLATE_APPLY_CONFLICT (транзакция откатывается целиком)
```

**API модуля `event` для модуля `template`** (публичные методы `EventService`, не для контроллеров):

```java
List<Event> findOverlapping(UUID wsId, LocalDateTime from, LocalDateTime to);
List<EventResponse> createFromTemplate(UUID wsId, UUID userId, List<NewTemplateEvent> events);
void deleteByIds(UUID wsId, Collection<UUID> ids);
```

### 7.6. Ключевые запросы репозиториев

```java
// EventRepository
@Query("""
    select e from Event e
    where e.workspaceId = :ws
      and e.startLocal <  :to
      and e.endLocal   >  :from
      and e.startLocal >= :fromMinusMax      -- from.minusDays(31): включает индекс по start
    order by e.startLocal, e.id
    """)
List<Event> findOverlapping(UUID ws, LocalDateTime from, LocalDateTime to, LocalDateTime fromMinusMax);

@Query("""
    select e from Event e
    where e.workspaceId = :ws and e.endLocal > :now
    order by e.startLocal, e.id
    """)
Page<Event> findUpcoming(UUID ws, LocalDateTime now, Pageable pageable);

Optional<Event> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

// WorkspaceMemberRepository
boolean existsByWorkspaceIdAndUserId(UUID workspaceId, UUID userId);
Optional<WorkspaceMember> findByUserId(UUID userId);
List<WorkspaceMember> findByWorkspaceIdOrderByJoinedAt(UUID workspaceId);
long countByWorkspaceId(UUID workspaceId);

// WorkspaceRepository
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select w from Workspace w where w.id = :id")
Optional<Workspace> findByIdForUpdate(UUID id);

// WeekTemplateRepository
Optional<WeekTemplate> findByIdAndWorkspaceId(UUID id, UUID workspaceId);
List<WeekTemplate> findByWorkspaceIdOrderByName(UUID workspaceId);
boolean existsByWorkspaceIdAndNameIgnoreCase(UUID workspaceId, String name);

// TemplateApplicationRepository
List<TemplateApplication> findByWorkspaceIdAndWeekStartOrderByAppliedAt(UUID ws, LocalDate weekStart);
Optional<TemplateApplication> findFirstByTemplateIdOrderByAppliedAtDesc(UUID templateId);
Page<TemplateApplication> findByWorkspaceIdOrderByAppliedAtDesc(UUID ws, Pageable pageable);
```

### 7.7. Оптимистическая блокировка в PUT

Сравнивайте версию **вручную**: `@Version` сам по себе не сравнит версию из DTO с версией в БД.

```java
Event e = repo.findByIdAndWorkspaceId(id, wsId).orElseThrow(...);
if (req.version() == null) throw new ApiException(VERSION_REQUIRED, …);
if (e.getVersion() != req.version()) throw new ApiException(VERSION_CONFLICT, …);
// меняем поля; @Version защитит от гонки между SELECT и UPDATE
```

JPA запрещает приложению менять поле `@Version` вручную, а поведение при таком изменении зависит от реализации. Поэтому версию из DTO сравниваем явно, как выше, а `@Version` страхует от гонки двух одновременных UPDATE.

---

## 8. Конфигурация

### `.env.example` (в git; сам `.env` — в `.gitignore`)

```
POSTGRES_DB=together
POSTGRES_USER=together
POSTGRES_PASSWORD=change-me
DB_URL=jdbc:postgresql://localhost:5432/together
JWT_SECRET=base64-строка-минимум-32-байта   # openssl rand -base64 48
REFRESH_COOKIE_SECURE=true
```

### `application.yml`

```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${POSTGRES_USER}
    password: ${POSTGRES_PASSWORD}
  jpa:
    open-in-view: false
    hibernate.ddl-auto: validate
    properties:
      hibernate.jdbc.time_zone: UTC
      hibernate.default_batch_fetch_size: 50
  flyway:
    enabled: true

app:
  security:
    jwt-secret: ${JWT_SECRET}
    access-token-ttl: 15m
    refresh-token-ttl: 30d
    refresh-cookie-secure: ${REFRESH_COOKIE_SECURE:true}
  invites:
    ttl: 7d

springdoc:
  swagger-ui.path: /swagger-ui.html
```

### `docker-compose.yml` для разработки (только БД)

```yaml
services:
  postgres:
    image: postgres:18
    env_file: .env
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql]
volumes:
  pgdata:
```

В образах `postgres:18+` данные лежат в `/var/lib/postgresql`. В версиях ≤ 17 том монтировался в `/var/lib/postgresql/data`.

### Зависимости (`pom.xml`)

| Назначение | Артефакт |
|---|---|
| REST | `spring-boot-starter-web` (в Boot 4: `spring-boot-starter-webmvc`) |
| Безопасность | `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server` |
| JPA | `spring-boot-starter-data-jpa`, `org.postgresql:postgresql` (runtime) |
| Миграции | Boot 4: `spring-boot-starter-flyway`; Boot 3.5: `flyway-core`. Плюс `flyway-database-postgresql` |
| Валидация | `spring-boot-starter-validation` |
| Swagger | `org.springdoc:springdoc-openapi-starter-webmvc-ui` (2.8.x для Boot 3.5, 3.x для Boot 4) |
| Здоровье | `spring-boot-starter-actuator` (только `health`) |
| Lombok | `org.projectlombok:lombok` (provided + annotationProcessorPaths) |
| Тесты | `spring-boot-starter-test`, `spring-security-test`, `spring-boot-testcontainers`, `org.testcontainers:postgresql`, `org.testcontainers:junit-jupiter` |

В Swagger подключите схему `bearerAuth` (HTTP bearer, JWT) в `OpenApiConfig` и аннотацию `@SecurityRequirement(name = "bearerAuth")` на защищённых контроллерах.

---

## 9. Тесты — что обязательно покрыть

**Unit-тесты (JUnit 5 + Mockito, без Spring):**

| Класс | Сценарии |
|---|---|
| `ApplyPlanner` | MERGE на пустую неделю; повторный MERGE → 0 созданных, всё в `skippedAlreadyApplied`; FILL пропускает занятый день только для занятого участника; REPLACE удаляет только шаблонные, при `includeManual` — и ручные; конфликт попадает в `conflicts`, но создаётся; «Сон» вс 23:00 переходит в понедельник следующей недели |
| `EventValidator` | `end <= start`; через полночь — ок; > 31 дня; участник не из пространства; обрезка секунд |
| `TimeService` | `weekStart` для любого дня недели; нормализация несуществующего времени (тест на поясе с DST, например `Europe/Berlin` 2026-03-29 02:30) |
| `TemplateService` | Diff по id: обновление на месте, удаление, добавление, чужой id → 400 |
| `RefreshTokenService` | Ротация; повторное использование отзывает все токены |

**Интеграционные (Testcontainers PostgreSQL + `MockMvc` / `RestClient`, `Clock` зафиксирован на 2026-11-06):**

1. Регистрация → логин → `/me` без пространства → создание → инвайт → второй пользователь присоединяется → третий получает `409 WORKSPACE_FULL`.
2. Два параллельных join на одно пространство → в итоге ровно 2 участника.
3. **Будущее событие:** «Поездка» 2026-11-20 08:00–20:00 для обоих → `GET /week?date=2026-11-16` содержит его, а неделя 2026-11-09 — нет.
4. **Через полночь:** событие пт 23:00 – сб 07:00 сохраняется и попадает в неделю. Событие вс 23:00 – пн 07:00 попадает в обе недели.
5. **Применение шаблона:** к неделе 2026-11-09 создано N событий с верными датами.
6. **Повторное применение:** создано 0, в истории 2 записи.
7. **Изменение события после применения:** переносим событие из шаблона → повторный MERGE не создаёт дубль.
8. **Изменение шаблона после применения:** PUT шаблона (меняем время) → события недели не изменились.
9. **Удаление шаблона:** события остались, у записи истории `templateId = null`, имя сохранилось.
10. **Совместное событие:** `participantIds` содержит обоих, оно приходит в неделю один раз с двумя участниками.
11. **Чужое пространство:** пользователь из пространства X запрашивает событие, шаблон и неделю пространства Y по реальным UUID → `404` везде. Подмена `wsId` на свой с чужим `eventId` → тоже `404`.
12. **Конфликт версий:** два PUT с одной `version` → второй `409 VERSION_CONFLICT`.
13. **Откат транзакции:** при ошибке посередине apply (например, искусственно вызванный конфликт уникального индекса) не создано ни одного события и нет записи истории.
14. Ошибки валидации приходят в формате `ProblemDetail` с `code` и `errors[]`. Запрос без токена → `401` в том же формате.

Один контейнер на все интеграционные тесты: `@ServiceConnection` + `static @Container`, или singleton-паттерн. Это сильно ускоряет прогон.

---

## 10. Spring Boot 4 vs 3.5 — что заметить при написании

| Тема | Boot 3.5 | Boot 4 |
|---|---|---|
| Jackson | 2.x, `com.fasterxml.jackson` | 3.x, пакеты `tools.jackson` (аннотации остались в `com.fasterxml.jackson.annotation`) |
| Flyway | `flyway-core` подхватывается автоконфигурацией | Нужен `spring-boot-starter-flyway` |
| Тестовые срезы | `@WebMvcTest` и др. в `spring-boot-test-autoconfigure` | Вынесены в модули (`spring-boot-webmvc-test` и т. п.) |
| Hibernate | 6.6 | 7.x |
| springdoc | 2.8.x | 3.x |

Остальное в спецификации (DTO, SQL, Security DSL, `ProblemDetail`) одинаково для обеих версий.

---

## 11. Рекомендуемый порядок реализации

1. Каркас: проект, `docker-compose` с БД, `application.yml`, `ErrorCode` + `ApiException` + `GlobalExceptionHandler`, `Clock`, Swagger. Тест: контекст поднимается на Testcontainers.
2. `V1` + `user` + `auth` (register, login, me) + Security. Затем refresh и logout.
3. `V2` + `workspace` (создание, current, members, invite, join) + `WorkspaceAccessService`.
4. `V3` + `event` (CRUD, диапазон, upcoming) + `schedule` (неделя).
5. `V4` + `template` (CRUD с diff) → `ApplyPlanner` (сначала unit-тесты) → apply + история.
6. Прогон всех интеграционных сценариев из раздела 9.

После каждого шага — зелёные тесты, затем коммит.
