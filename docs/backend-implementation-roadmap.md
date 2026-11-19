# Together Planner — пошаговый план реализации backend

Основа — `backend-spec-v2.md` (дальше просто «spec»). Ссылки вида «spec §9.4» ведут туда.
Задачи идут строго по порядку: каждая опирается на предыдущие. Одна задача ≈ один коммит.

**Общий Definition of Done для каждой задачи** (в задачах не повторяется):
- `./mvnw verify` зелёный: все unit- и интеграционные тесты проходят;
- нет `TODO` вместо работающей логики;
- Entity не выходят за пределы своего модуля и не возвращаются из контроллеров;
- новые эндпоинты видны в Swagger UI с кодами ответов;
- коммит без лишних файлов (`.env`, `target/`, `.idea/`).

---

## Этап 0. Подготовка окружения

### 0.1. JDK, Docker, репозиторий
- **Сделать:**
  - `JAVA_HOME` → JDK 21 (например, `C:\Users\kabdy\.jdks\jbr-21.0.11`); `%JAVA_HOME%\bin` в `PATH`.
  - Запустить Docker Desktop.
  - Структура репозитория в `C:\private projects`:
    ```
    backend/              ← Maven-проект
    docs/                 ← спецификации (уже есть)
    design/               ← перенести сюда прототип (Main.dc.html, support.js, vendor/, README.md)
    docker-compose.yml
    .env.example
    .gitignore            ← .env, target/, .idea/, *.iml, node_modules/
    ```
  - `git init`.
- **DoD:** `java -version` показывает 21; `docker info` работает; первый коммит с `docs/`, `.gitignore`, `.env.example`.

### 0.2. Проверка Testcontainers с Docker Engine 29
- **Зачем:** Docker 29 поднял минимальную версию API. Boot 4.1.2 тянет Testcontainers 2.0.5, где это исправлено. Проверяем заранее, чтобы не разбираться с этим посреди этапа 2.
- **Сделать:** после задачи 1.1 запустить тест из 1.6. Если падает с `client version … is too old`, создать `%USERPROFILE%\.docker-java.properties` со строкой `api.version=1.44`.
- **DoD:** контейнер `postgres:18-alpine` поднимается из теста.

---

## Этап 1. Каркас и общие компоненты

### 1.1. Maven-проект
- **Сделать:** `backend/pom.xml` с родителем `spring-boot-starter-parent:4.1.2`, Java 21 и зависимостями из spec §12.1. Проще всего сгенерировать каркас на start.spring.io (Boot 4.1.2, Maven, Java 21) — там же будет Maven Wrapper — и сверить список стартеров со spec §12.1.
  - В Boot 4 тестовые срезы — отдельные стартеры. Без `spring-boot-starter-webmvc-test` не найдётся `@AutoConfigureMockMvc`.
  - springdoc `3.2.0` указывается с явной версией.
- **Классы:** `TogetherPlannerApplication`.
- **DoD:** `./mvnw -q package -DskipTests` собирает jar; Lombok обрабатывается (`annotationProcessorPaths`).

### 1.2. База и конфигурация
- **Сделать:**
  - `docker-compose.yml` — только сервис `postgres` (spec §12.3);
  - `.env` из `.env.example`, `JWT_SECRET` через `openssl rand -base64 48`;
  - `application.yml` (spec §12.2);
  - пустая папка `src/main/resources/db/migration`.
- **DoD:** `docker compose up -d postgres` → healthy; приложение стартует и подключается к БД (Flyway: «no migrations found» — нормально).

### 1.3. Ошибки и общий веб-слой (`common`)
| Класс | Ответственность |
|---|---|
| `ErrorCode` | Enum кодов из spec §7.4, у каждого свой `HttpStatus` |
| `ApiException` | Единственное бизнес-исключение: `ErrorCode` + текст |
| `ConstraintErrorMapper` | Имя ограничения БД → `ErrorCode` (spec §7.3) |
| `GlobalExceptionHandler` | `@RestControllerAdvice extends ResponseEntityExceptionHandler`, таблица spec §7.2 |
| `PageResponse<T>` | Обёртка страницы (spec §8.2) |

- **Тесты:** `ConstraintErrorMapperTest` (каждое имя → свой код, неизвестное → `DATA_CONFLICT`).
- **DoD:** тест проходит. В конце этапа 1 временный тестовый контроллер в `src/test` проверяет, что `ApiException` и ошибка валидации отдают `ProblemDetail` с полем `code`.

### 1.4. Время (`common.time`, `config`)
| Класс | Ответственность |
|---|---|
| `ClockConfig` | Бин `Clock.systemUTC()` |
| `TimeRules` | Статические чистые функции: `weekStart`, `normalize` (DST, spec §3 правило 2), `overlaps`, `isValidRegionZone` |
| `TimeService` | `now(ZoneId)`, `today(ZoneId)`, `nowInstant()` через `Clock` |

- **Тесты:** `TimeRulesTest` — TR1–TR6 (spec §14.2).
- **DoD:** TR1–TR6 зелёные.

### 1.5. Swagger
- **Классы:** `OpenApiConfig` — информация об API и схема безопасности `bearerAuth` (HTTP bearer, JWT).
- **Важно:** `spring-boot-starter-security` уже в `pom.xml` (задача 1.1), а `SecurityConfig` появится только в задаче 2.2. До тех пор auto-config Spring Security сам создаёт `SecurityFilterChain`, требующий логин для всех путей, включая `/swagger-ui/**` — это ожидаемо, а не ошибка задачи 1.5.
- **DoD:** OpenAPI-документ формируется корректно (бин `OpenAPI` собирается, в нём есть схема `bearerAuth`). Проверить без постоянного кода безопасности — временным запуском с `--spring.autoconfigure.exclude=org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration,org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration,org.springframework.boot.security.autoconfigure.actuate.web.servlet.ManagementWebSecurityAutoConfiguration` (только для проверки, не коммитится) или тестом `@AutoConfigureMockMvc(addFilters = false)`. `http://localhost:8080/swagger-ui.html` буквально открывается в браузере только после задачи 2.2, когда `SecurityConfig` явно разрешит `/swagger-ui/**` и `/v3/api-docs/**` (spec §10.7).

### 1.6. Тестовая инфраструктура (`src/test`)
| Класс | Ответственность |
|---|---|
| `AbstractIntegrationTest` | `@SpringBootTest`, `@AutoConfigureMockMvc` (пакет `org.springframework.boot.webmvc.test.autoconfigure`), статический `org.testcontainers.postgresql.PostgreSQLContainer("postgres:18-alpine")` с `@ServiceConnection` |
| `MutableClock` | Подкласс `Clock` с `setInstant` / `advance`; бин `@Primary` в `TestClockConfig`, старт `2026-11-06T06:00:00Z` |
| `DatabaseCleaner` | `TRUNCATE … CASCADE` всех таблиц, кроме `flyway_schema_history`, в `@BeforeEach` |

- **Тесты:** `ApplicationContextIT` — контекст поднимается.
- **DoD:** тест зелёный на настоящем PostgreSQL в контейнере (вместе с 0.2).

---

## Этап 2. Пользователи, безопасность, аутентификация

### 2.1. Миграция V1 и модуль `user`
- **Создать по порядку:**
  1. `V1__users_and_auth.sql` (spec §5.1);
  2. `User` (entity), `UserRepository`;
  3. `UserResponse`, `UserCredentials` (dto), `UserMapper`;
  4. `UserService`: `create`, `findCredentialsByEmail`, `getById`, `displayNames` (spec §6.4).
- **Тесты:** `UserRepositoryIT` — сохранение и поиск по email; email в верхнем регистре отвергает `CHECK`.
- **DoD:** Flyway применяет V1; `ddl-auto: validate` проходит.

### 2.2. Spring Security и JWT (`security`)
- **Создать по порядку:**
  1. `SecurityProperties` (`@ConfigurationProperties` record + `@EnableConfigurationProperties`);
  2. `JwtConfig` — encoder и decoder с проверкой длины ключа, issuer и `Clock` (spec §10.3);
  3. `JwtService` + `IssuedAccessToken`;
  4. `ProblemResponseWriter`, `ProblemAuthenticationEntryPoint`, `ProblemAccessDeniedHandler`;
  5. `AuthCsrfHeaderFilter` — **не** `@Component`;
  6. `SecurityConfig` (spec §10.7).
- **Тесты:**
  - `JwtServiceTest`: токен содержит `iss`, `sub`, `exp = iat + 15 мин`.
  - `JwtConfigTest`: секрет короче 32 байт → `IllegalStateException`.
  - S-01, S-02, S-03 — через временный защищённый тестовый эндпоинт.
- **DoD:** запрос без токена → `401` в формате `ProblemDetail`; приложение не стартует с коротким секретом.

### 2.3. Регистрация, вход, `/me` (`auth`)
- **Создать по порядку:**
  1. DTO `RegisterRequest`, `LoginRequest`, `AuthResponse`, `MeResponse`;
  2. `AuthService.register`, `login`, `me`: нормализация email, проверка ≤ 72 байт, `DUMMY_HASH`;
  3. `AuthController` — A1, A2, A6 + `@Parameter` для `X-Requested-With`.
  На этом шаге `register`/`login` возвращают только access-токен; cookie появится в 2.4. `MeResponse.workspace` пока всегда `null` — это верно, пространств ещё нет; заполнится в 3.2.
- **Эндпоинты:** A1, A2, A6.
- **Тесты:**
  - `AuthServiceTest`: `PASSWORD_TOO_LONG` (40 кириллических символов), нормализация email.
  - `AuthIT`: регистрация → вход → `/me`; занятый email → `409`; неверный пароль → `401 INVALID_CREDENTIALS`; без `X-Requested-With` → `403` (S-07, часть); S-01 (без токена), S-02 (поддельная подпись, чужой `iss`), S-03 (`MutableClock` + 16 мин) — на `/auth/me`, теперь на настоящем эндпоинте вместо временного из задачи 2.2.
- **DoD:** весь сценарий работает через Swagger UI.

### 2.4. Refresh-токены, logout
- **Создать по порядку:**
  1. `RevokeReason`, `RefreshToken`, `RefreshTokenRepository` с `revokeIfActive` и `revokeAllActive` (`@Modifying` JPQL, возвращают `int`), `deleteExpired`;
  2. `RefreshCookieFactory` (создание и очистка cookie);
  3. `RefreshTokenService`: `issue`, `rotate` (`@Transactional(noRollbackFor = ApiException.class)`, spec §10.4), `revoke`, `revokeAll`;
  4. `IssuedTokens` (dto); встроить выдачу refresh в A1 и A2;
  5. A3, A4, A5 в `AuthController`;
  6. `SchedulingConfig` (`@EnableScheduling`), `RefreshTokenCleanupJob`.
- **Эндпоинты:** A3, A4, A5.
- **Тесты:**
  - `RefreshTokenServiceTest` — RT1–RT6.
  - `RefreshIT` — I-17, I-18; S-08 (атрибуты cookie); S-09 (массовый отзыв сохранился после 401); S-07 полностью.
- **DoD:** ротация работает; повтор в пределах 10 с → `REFRESH_TOKEN_ROTATED`; повтор позже → все токены отозваны (проверено в БД).

---

## Этап 3. Пространство

### 3.1. Миграция V2, сущности, проверка доступа
- **Создать по порядку:**
  1. `V2__workspaces.sql` (spec §5.2);
  2. `WorkspaceRole`, `Workspace`, `WorkspaceMember`, `WorkspaceInvite`;
  3. `WorkspaceRepository` (+ `findByIdForUpdate`), `WorkspaceMemberRepository`, `WorkspaceInviteRepository` (+ `markUsed`);
  4. `WorkspaceAccessService`: `requireMember`, `zoneOf`, `memberIds`, `lockForUpdate`.
- **Тесты:** `WorkspaceMemberRepositoryIT` — третья вставка в пространство падает на `uq_member_workspace_seat`; второе пространство у пользователя — на `uq_member_user`.
- **DoD:** V2 применяется; ограничения работают на уровне БД.

### 3.2. Создание и просмотр пространства
- **Создать по порядку:**
  1. DTO `CreateWorkspaceRequest`, `UpdateWorkspaceRequest`, `WorkspaceResponse`, `MemberResponse`;
  2. `WorkspaceMapper`;
  3. `WorkspaceService`: `create` (OWNER, место 1), `current`, `update`, `members`, `findForUser`;
  4. `WorkspaceController` — W1–W4;
  5. `AuthService.me` → `WorkspaceService.findForUser`.
- **Эндпоинты:** W1, W2, W3, W4.
- **Тесты:** `WorkspaceIT` — создание, `current`, `PATCH` с `+05:00` → `400 INVALID_TIME_ZONE`, повторное создание → `409 ALREADY_IN_WORKSPACE`, `/me` теперь с пространством; часть S-04 для W3, W4.
- **DoD:** все проверки зелёные.

### 3.3. Приглашения и присоединение
- **Создать по порядку:**
  1. `InviteCodeGenerator`;
  2. DTO `InviteResponse`, `JoinWorkspaceRequest`;
  3. `InviteService`: `createInvite` (удаляет прежние неиспользованные, `existsByCode` перед вставкой), `join` (spec §9.6, без пессимистической блокировки);
  4. W5, W6 в `WorkspaceController`.
- **Эндпоинты:** W5, W6.
- **Тесты:** `InviteCodeGeneratorTest`; I-01, I-02, I-03; C-01, C-07.
- **DoD:** два пользователя в одном пространстве на местах 1 и 2; третий получает `409`; гонка C-01 даёт ровно 2 участника.

---

## Этап 4. События

### 4.1. Миграция V3 и сущность
- **Создать по порядку:**
  1. `V3__events.sql` (spec §5.3);
  2. `EventCategory`, `EventColor`, `EventSource` (`@Embeddable`), `Event` (`@ElementCollection`, `@Version`);
  3. `EventRepository`: `findByIdAndWorkspaceId`, `findOverlapping`, `findUpcoming`, `findBySourceWeek`.
- **Тесты:** `EventRepositoryIT` — пересечение на границах (I-05 на уровне репозитория); `source` загружается как `null` для ручного события.
- **DoD:** V3 применяется; запросы возвращают то, что ожидается.

### 4.2. Правила события
- **Классы:** `EventValidator` (spec §9.7).
- **Тесты:** `EventValidatorTest` — все кейсы spec §14.2.
- **DoD:** все кейсы зелёные.

### 4.3. CRUD событий
- **Создать по порядку:**
  1. DTO `EventRequest`, `EventResponse`, `EventSourceResponse`, `TemplateOccurrenceDeletedEvent`;
  2. `EventMapper`;
  3. `EventService`: `create`, `get`, `update` и `deleteByUser` — оба с явной проверкой версии через общий `requireVersion` (spec §9.7). `deleteByUser` публикует `TemplateOccurrenceDeletedEvent`, если есть `source`; слушатель появится в 7.2, публикация без слушателя безопасна;
  4. `EventController` — E3–E6; в E6 `@RequestParam(required = false) Long version` (spec §8.6).
- **Эндпоинты:** E3, E4, E5, E6.
- **Тесты:** `EventIT` — создание, правка, удаление; I-06; I-16; I-23 (DELETE без версии, со старой, с текущей); I-25 (DST); S-05, S-06; часть S-04 для E3–E6; C-04, C-06.
- **DoD:** событие на двоих сохраняется с двумя участниками; конфликт версий в PUT и DELETE → `409`; DELETE без версии → `400 VERSION_REQUIRED`.

### 4.4. Диапазон и ближайшие события
- **Сделать:** `EventService.listRange` (проверка ≤ 93 дней) и `upcoming`; E1, E2 в контроллере.
- **Эндпоинты:** E1, E2.
- **Тесты:** I-19, I-20; часть S-04.
- **DoD:** пагинация `upcoming` корректна; диапазон 94 дня → `400`.

---

## Этап 5. Шаблоны (CRUD)

### 5.1. Миграция V4 и сущности
- **Создать по порядку:**
  1. `V4__templates.sql` (spec §5.4) — все шаблонные таблицы сразу, включая журнал и исключения;
  2. `ApplyMode`, `DayOfWeekConverter`, `WeekTemplate`, `TemplateEvent`, `TemplateApplication`, `OccurrenceExclusionId`, `OccurrenceExclusion`;
  3. `WeekTemplateRepository`, `TemplateApplicationRepository`, `OccurrenceExclusionRepository`.
- **Тесты:** `WeekTemplateRepositoryIT` — каскадное удаление шаблона удаляет его события и исключения; у журнала `template_id` становится `NULL`.
- **DoD:** V4 применяется; каскады работают.

### 5.2. CRUD шаблонов
- **Создать по порядку:**
  1. DTO `TemplateRequest`, `TemplateEventRequest`, `TemplateResponse`, `TemplateEventResponse`, `TemplateApplicationResponse`;
  2. `TemplateMapper`;
  3. `TemplateService`: `list`, `create`, `get`, `update` (diff по id, spec §9.8; проверка версии; участники ∈ пространству), `delete` (проверка `?version=`); `lastApplication` через `TemplateApplicationRepository.findFirstByTemplateIdOrderByAppliedAtDesc`;
  4. `TemplateController` — T1–T5.
- **Эндпоинты:** T1, T2, T3, T4, T5.
- **Тесты:** `TemplateServiceTest` (diff); `TemplateIT` — CRUD, `409 TEMPLATE_NAME_TAKEN` (без учёта регистра), `400 TEMPLATE_EVENT_NOT_FOUND`, I-24 (DELETE с версией); часть S-04.
- **DoD:** после PUT id сохранённых событий шаблона не меняются.

---

## Этап 6. Планировщик применения

### 6.1. `ApplyPlanner` — чистая логика
- **Создать по порядку:**
  1. `BusyDayRule` — константа `BUSY_FROM = LocalTime.NOON` и `makesDayBusy(day, start, end)` (spec §9.1). Единственное место с порогом 12:00;
  2. DTO `PlannedEvent`, `ApplyConflict`, `PlanInput`, `ApplyPlan`, `ApplyPreviewResponse`;
  3. `ApplyPlanner` — без Spring-зависимостей, только `TimeRules` и `BusyDayRule` (spec §9.1–§9.4).
- **Тесты:**
  - `BusyDayRuleTest` — BD1–BD10: ночные события, через полночь, граница 12:00, многодневные;
  - `ApplyPlannerTest` — **все** кейсы M1–M8, F1–F10, R1–R8 на общей фикстуре (spec §14.2).

  Пишите тесты **до** реализации: кейсы уже готовы.
- **DoD:** 36 кейсов зелёные без базы данных и Spring; поиск по `src/main` находит `NOON` / `12, 0` только в `BusyDayRule`.

---

## Этап 7. Применение шаблона

### 7.1. Межмодульные методы `EventService`
- **Сделать:** `findOverlapping`, `findBySourceWeek`, `createFromTemplate` (через `EventValidator`), `deleteForTemplateReplace` (`remove` + `flush()`) — spec §6.4. DTO `NewTemplateEvent`.
- **Тесты:** `EventServiceIT` — `deleteForTemplateReplace` и `createFromTemplate` с тем же ключом в одной транзакции не падают (проверка flush).
- **DoD:** тест зелёный; без `flush()` тот же тест падает (проверить один раз, убрав вызов).

### 7.2. Исключения удалённых вхождений
- **Классы:** `OccurrenceExclusionService`: `@EventListener on(TemplateOccurrenceDeletedEvent)` (вставка, только если событие шаблона существует), `excludedFor(weekStart, ids)`, `clear(weekStart, ids)`.
- **Тесты:** `OccurrenceExclusionIT` — E6 по событию из шаблона создаёт исключение; удаление ручного события — нет; удаление события, чьего события шаблона уже нет, проходит без ошибки FK.
- **DoD:** исключение появляется в той же транзакции, что и удаление.

### 7.3. Предпросмотр, применение, история
- **Создать по порядку:**
  1. DTO `ApplyTemplateRequest` (с `confirmedDeleteIds` и `confirmedRestoredIds`), `ApplyResultResponse`;
  2. `TemplateApplyService`: `preview` (`readOnly`), `apply` (spec §9.5, шаги 1–11), `history`, `findApplicationsForWeek`. Загрузка данных для плана — один приватный метод, общий для `preview` и `apply`;
  3. T6, T7 в `TemplateController`; `TemplateApplicationController` — T8.
- **Эндпоинты:** T6, T7, T8.
- **Тесты:** I-07 – I-15; I-21, I-22 (восстановление в REPLACE только после показа); C-02; часть S-04 для T6–T8.
- **DoD:** все сценарии применения из матрицы spec §14.6 зелёные; REPLACE после MERGE не падает (I-12); устаревший план (удаления или восстановления) → `409` без изменений (I-13, I-22); откат проверен (I-14).

---

## Этап 8. Недельное представление

### 8.1. `schedule`
- **Классы:** `WeekResponse`, `WeekViewService` (`requireMember` → `zoneOf` → `members` → `findOverlapping` → `findApplicationsForWeek`), `WeekController`.
- **Эндпоинты:** S1.
- **Тесты:** `WeekIT` — I-04, I-05; `date` по умолчанию = «сегодня» по `MutableClock`; `appliedTemplates` после T7; часть S-04.
- **DoD:** неделя 2026-11-16 содержит «Поездку» 20.11, неделя 2026-11-09 — нет.

---

## Этап 9. Укрепление

### 9.1. Набор конкурентных тестов
- **Сделать:** C-01 – C-06 в одном классе `ConcurrencyIT` (без `@Transactional`; `ExecutorService` + `CountDownLatch`). Часть уже написана на этапах 3–7 — собрать в одном месте.
- **DoD:** 10 прогонов подряд зелёные (`-Dsurefire.rerunFailingTestsCount=0`, цикл в shell). Нестабильный тест = баг, а не «невезение».

### 9.2. Набор тестов безопасности
- **Сделать:** S-04 как параметризованный тест по **всем** member-эндпоинтам (W3–W5, S1, E1–E6, T1–T8); S-10; S-11 (CORS не одобряет чужой origin).
- **DoD:** нет ни одного member-эндпоинта без проверки «чужое пространство → 404».

### 9.3. Ревью по чек-листу
- [x] Все сервисные методы под `/workspaces/{wsId}` начинаются с `requireMember` (W3–W5 — тем же вызовом, но в контроллере, до делегирования в `WorkspaceService`/`InviteService`; межмодульные методы спец. §6.4 — исключение по дизайну). Подтверждено всеми 18 кейсами `ForeignWorkspaceAccessIT`.
- [x] Все поиски ресурсов — `ByIdAndWorkspaceId` (кроме поиска самого `Workspace` по его собственному id — у него нет родителя).
- [x] Ни один контроллер не возвращает Entity; ни один модуль не импортирует чужие `entity` / `repository` (кроме документированного переиспользования enum `EventCategory`/`EventColor`, `ApplyMode`, `WorkspaceRole`).
- [x] Пессимистическая блокировка — только в `TemplateApplyService.apply` (единственный вызывающий `WorkspaceAccessService.lockForUpdate`).
- [x] В логах нет паролей, токенов и cookie (всего 3 `log.*` во всём `src/main` — метод/URI, исключение, имя constraint).
- [x] `ErrorCode` совпадает с каталогом spec §7.4 (34 кода, один к одному, те же HTTP-статусы).
- **DoD:** все пункты отмечены.

---

## Этап 10. Docker и документация

### 10.1. Контейнер backend
- **Сделать:** `backend/Dockerfile` (spec §12.3), профиль `app` в `docker-compose.yml`, `backend/.dockerignore` (`target/`).
- **DoD:** `docker compose --profile app up --build` → `GET /actuator/health` = `UP`; регистрация через Swagger работает.

### 10.2. README
- **Сделать:** `README.md` в корне: требования (JDK 21, Docker), запуск БД, запуск backend, запуск тестов, переменные `.env`, ссылка на Swagger и на `docs/`.
- **DoD:** человек с чистой машиной поднимает backend по README без вопросов.

---

## Матрица «эндпоинт → задача → тесты»

| Эндпоинт | Задача | Тесты |
|---|---|---|
| A1 register | 2.3 (cookie — 2.4) | AuthIT, S-08 |
| A2 login | 2.3 (cookie — 2.4) | AuthIT, S-08 |
| A3 refresh | 2.4 | RT1–RT6, I-17, C-03, S-07, S-09 |
| A4 logout | 2.4 | RefreshIT, S-07 |
| A5 logout-all | 2.4 | I-18 |
| A6 me | 2.3, 3.2 | AuthIT, WorkspaceIT |
| W1 create | 3.2 | WorkspaceIT, I-01 |
| W2 current | 3.2 | WorkspaceIT |
| W3 patch | 3.2 | WorkspaceIT, I-26, S-04 |
| W4 members | 3.2 | WorkspaceIT, S-04 |
| W5 invite | 3.3 | I-01, I-02, S-04 |
| W6 join | 3.3 | I-01–I-03, C-01 |
| S1 week | 8.1 | I-04, I-05, WeekIT, S-04 |
| E1 range | 4.4 | I-19, S-04 |
| E2 upcoming | 4.4 | I-20, S-04 |
| E3 create | 4.3 | EventIT, I-06, I-25, S-06 |
| E4 get | 4.3 | EventIT, S-05 |
| E5 update | 4.3 | I-16, C-04 |
| E6 delete | 4.3, 7.2 | EventIT, I-23, C-06, OccurrenceExclusionIT, I-11, I-21 |
| T1 list | 5.2 | TemplateIT |
| T2 create | 5.2 | TemplateIT |
| T3 get | 5.2 | TemplateIT, S-05 |
| T4 update | 5.2 | TemplateServiceTest, I-10 |
| T5 delete | 5.2 | I-15, I-24 |
| T6 preview | 7.3 | I-11, I-13, I-21 |
| T7 apply | 7.3 | I-07–I-09, I-12–I-14, I-21, I-22, C-02 |
| T8 history | 7.3 | I-08, I-15 |

Всего 27 эндпоинтов — совпадает со сводкой spec §8.1.

---

## Самопроверка трёх документов

Проверено: согласованность SQL ↔ Entity ↔ DTO ↔ API, покрытие эндпоинтов задачами, покрытие правил тестами, ссылки между документами.

### Найденные и исправленные расхождения

| # | Расхождение | Исправление |
|---|---|---|
| 1 | В отчёте ссылки на разделы spec не совпадали с итоговой нумерацией (§8.2 / §8.7 / §5.10 и др.) | Ссылки в отчёте приведены к нумерации v2 |
| 2 | Количество эндпоинтов: отчёт и сводка spec говорили «26», фактически 27 (A1–A6, W1–W6, S1, E1–E6, T1–T8) | Везде 27 |
| 3 | Тест-кейсы refresh: в таблице RT1–RT5 и RT7, а в матрице «RT1–RT7» (RT6 отсутствовал) | Нумерация RT1–RT6 в spec и отчёте |
| 4 | Отчёт (A-08) описывал новый тип `EventSnapshot`, а spec использует `EventResponse` | Отчёт исправлен: через границу передаётся `EventResponse`; лишний тип не вводится |
| 5 | Тест отката I-14 не мог сработать: событие, вставленное «в обход планировщика», планировщик находит как уже применённое, и ошибки нет | I-14 переписан: сбой при сохранении журнала через `@MockitoSpyBean` → проверка отката удалений и вставок |
| 6 | C-01 предполагал два разных кода, но W5 удаляет прежние неиспользованные коды | C-01: один код, допустимы оба кода ошибки, проверяется итог в БД |
| 7 | Предпросмотр T6 формально включал проверку `confirmedDeleteIds` | T6: шаг 2 без этой проверки |
| 8 | `AuthCsrfHeaderFilter` внедрялся как бин: Spring Boot зарегистрировал бы его дважды | Фильтр создаётся через `new` в `SecurityConfig`; в задаче 2.2 — «не `@Component`» |
| 9 | В отчёте номер теста REPLACE (R5) указывал на устаревший план, а в spec R5 — другой сценарий | Ссылка заменена на I-13 |
| 10 | **[2026-11-19]** Таблица §8.4 обещала для W5 `409 WORKSPACE_FULL`, но `InviteService.createInvite` число участников не проверял, а I-02 выпускал новый код уже после присоединения партнёра — иначе свежего кода не получить, ведь W5 удаляет неиспользованные | D-10: W5 при двух участниках → `409 WORKSPACE_FULL`, приглашения не меняются. I-02 переделан: W5 при полном пространстве и W6 по неиспользованному коду, оставшемуся после гонки (вставлен в БД). Добавлен C-07 — одновременный W6 по разным кодам |

### Ревизия 2026-11-13: решения Q-1…Q-6

**Порядок этапов не изменился.** Новые решения ложатся в существующие задачи:

| Решение | Задачи |
|---|---|
| Q-1 `BusyDayRule` | 1.4 (`isNightTail` убран из `TimeRules`), 6.1 (новый класс, BD1–BD10, F1–F10) |
| Q-2 `confirmedRestoredIds` | 6.1 (R8, F10), 7.3 (DTO, I-21, I-22) |
| Q-3 DELETE с версией | 4.3 (E6, I-23, C-06), 5.2 (T5, I-24), 9.1 (C-06) |
| Q-4 один origin, CSRF | 2.2/2.4 (S-07 расширен), 9.2 (S-11); конфиг nginx — вместе с frontend |
| Q-5 Boot 4.1.2 | 0.2, 1.1, 1.6 |
| Q-6 пояс пространства | 1.4 (DST в `normalize`), 4.3 (I-25), 3.2 (I-26) |

Расхождения, найденные при перекрёстной проверке после внесения решений:

| # | Расхождение | Исправление |
|---|---|---|
| 10 | Матрица spec §14.6 ссылалась на F2 и F5 по старой нумерации FILL | Ссылки на F3 и F8 |
| 11 | I-22 в первой редакции менял и набор удаления, и набор восстановления, поэтому не проверял именно восстановление | Сценарий с перенесённым на другую неделю событием: меняется только `restoredDeleted` |
| 12 | spec §10.5 утверждал, что `SameSite=Strict` не даёт установить cookie из межсайтового ответа; для навигации верхнего уровня это неверно | Login CSRF закрывается обязательным заголовком; S-07 проверяет A1 и A2 |
| 13 | `DELETE_CONFIRMATION_REQUIRED` больше не описывал смысл: подтверждается и восстановление | Код переименован в `REPLACE_CONFIRMATION_REQUIRED` во всех документах |
| 14 | Обнаружено при реализации: DoD задачи 1.5 («Swagger UI открывается») невыполним буквально, так как `spring-boot-starter-security` уже на classpath с задачи 1.1, а `SecurityConfig` появляется только в 2.2 — до тех пор auto-config Spring Security блокирует все пути логином | DoD 1.5 переформулирован: проверка через временное исключение автоконфигурации безопасности или `addFilters = false`; полноценное открытие в браузере — факт задачи 2.2 |
| 15 | Обнаружено при реализации задачи 1.6/2.1: код spec §14.1 (`@Testcontainers` + `@Container` на статическом поле `AbstractIntegrationTest`) не даёт одного контейнера на весь прогон — при переходе от одного `*IT`-класса к другому Testcontainers останавливает контейнер в `afterAll`, и следующий класс падает на `CannotGetJdbcConnection` после 30-секундного тайм-аута `HikariPool` (подтверждено прогоном: `ApplicationContextIT` зелёный, `UserRepositoryIT` сразу после — красный с этой ошибкой) | `AbstractIntegrationTest` переписан: контейнер запускается в статическом инициализаторе, без `@Testcontainers`/`@Container`. spec §14.1 исправлен |
| 16 | Обнаружено при реализации задачи 2.2: §8.0 требовал заголовок `X-Requested-With` для **всех** POST на `/auth/**`, а §10.5 и тест S-07 защищают только четыре cookie-эндпоинта (A1, A2, A3, A4) — `/auth/logout-all` (A5) только `bearer`, подделать межсайтово нечем | §8.0 переформулирован: список из четырёх путей вместо `/auth/**`; `AuthCsrfHeaderFilter` матчит их явно |
| 17 | Обнаружено тестом S-03 при реализации задачи 2.2: `new JwtTimestampValidator()` по умолчанию допускает 60 с расхождения часов. Тест «MutableClock + 16 мин» на 15-минутном токене — это ровно 60 с просрочки, то есть граница допуска, и токен проходил валидацию (`200` вместо `401`) | `JwtTimestampValidator(Duration.ZERO)` — нулевой допуск. spec §10.3 исправлен |
| 19 | Обнаружено при реализации задачи 2.4 (`RefreshIT`, I-18): `RefreshTokenService.revoke`/`revokeAll` падали с `InvalidDataAccessApiUsageException: No active transaction for update or delete query`. Базовые методы `JpaRepository` (`save`, `delete`) сами транзакционны, но custom `@Modifying @Query`-методы (`revokeIfActive`, `revokeAllActive`, `deleteExpired`) — нет; `rotate()` уже был `@Transactional`, а `revoke`/`revokeAll` — нет | `@Transactional` добавлен на `revoke` и `revokeAll`. spec §11 дополнен примечанием |
| 20 | Обнаружено при реализации задачи 4.3 (`EventIT`): `EventService.get` падал с `LazyInitializationException` на `event.getParticipantIds()` — метод не был `@Transactional`, сессия Hibernate закрывалась до того, как `EventMapper.toResponse` читал ленивую `@ElementCollection` | `@Transactional(readOnly = true)` на `EventService.get`. spec §11 дополнен примечанием про ленивые коллекции |
| 21 | Обнаружено при реализации задачи 4.3 (`EventIT`): после E5 (PUT) ответ содержал старую `version` (0 вместо 1). Hibernate увеличивает `@Version` во время самого `UPDATE`, а `UPDATE` без явного `flush()` выполняется только при коммите — ПОСЛЕ того, как метод уже вернул `EventResponse` с версией, прочитанной из ещё не обновлённой в памяти сущности | `eventRepository.flush()` перед сборкой ответа в `EventService.update`. То же нужно будет для T4 (обновление шаблона, этап 5) |
| 22 | Обнаружено при реализации задачи 6.1: spec §9.4 называет тип результата `ApplyPlanner.plan(PlanInput) → ApplyPlan` в заголовке алгоритма, но нигде не даёт `ApplyPlan` явного определения полей (в отличие от `ApplyPreviewResponse`, `PlanInput`, `PlannedEvent`, `ApplyConflict`, у которых есть record-сигнатуры) | `ApplyPlan` реконструирован как те же восемь вычисляемых списков/счётчик, что в `ApplyPreviewResponse`, но без `weekStart`/`mode` — это входные параметры, не результат планирования; их эхо в HTTP-ответ добавит `TemplateApplyService` на этапе 7. Обоснование — в Javadoc класса |
| 23 | Обнаружено при реализации задачи 7.1: первая версия `EventServiceIT` (вызов `deleteForTemplateReplace` + `createFromTemplate` внутри `@Transactional`-теста, проверка только на возвращённых DTO) давала ложноположительный результат — тест оставался зелёным даже после удаления `flush()` из продакшен-кода. Причина: Spring откатывает `@Transactional`-тест в конце без гарантированного `flush()`, а `createFromTemplate` строит DTO из уже находящихся в памяти сущностей с клиентским UUID (`@UuidGenerator`) — SQL мог вовсе не отправляться в Postgres до `ROLLBACK` | В тест добавлен явный `eventRepository.flush()` после обоих вызовов, перед проверками — это заставляет реально выполнить INSERT/DELETE и проверить их порядок. Негативная проверка (DoD задачи 7.1) повторно подтверждена: без `flush()` в продакшен-коде исправленный тест падает с `uq_event_template_source` |
| 24 | Обнаружено при реализации задачи 9.1 (`ConcurrencyIT`, C-06): конкурентные PUT и DELETE одного события иногда давали не `200/204` + `404/409` (ожидание spec), а `500` — Postgres обнаруживал дедлок между UPDATE и DELETE строк `event_participant` (`@ElementCollection`) одного `event_id` и прерывал один из запросов до того, как Hibernate успевал дойти до проверки `@Version`; `CannotAcquireLockException` не был в списке `GlobalExceptionHandler` и падал в общий `Exception.class` → `500` | Добавлен `@ExceptionHandler(CannotAcquireLockException.class)` → `409 DATA_CONFLICT` (та же семантика, что и для прочих не предусмотренных сервисом гонок). Подтверждено 10 прогонами подряд (`-Dsurefire.rerunFailingTestsCount=0`) |
| 25 | Обнаружено при ревью чек-листа (задача 9.3), помимо шести его пунктов: spec §13 требует `log.info` при регистрации, создании пространства, join и применении шаблона, и `log.warn` при обнаружении повторного использования refresh-токена — ни один из этих вызовов не был запланирован ни в одной задаче roadmap (Этапы 1–9), поэтому их не было в коде вовсе | Добавлены `log.info`/`log.warn` в `AuthService.register`, `WorkspaceService.create`, `InviteService.join`, `TemplateApplyService.apply`, `RefreshTokenService.rotate` (reuse). Полный прогон тестов подтверждён зелёным |
| 18 | Обнаружено при реализации задачи 2.4: `Hibernate ddl-auto: validate` не стартовал — колонка `refresh_token.token_hash` в V1 определена как `char(64)`, а сущность `RefreshToken.tokenHash` маппилась как обычный `String`, то есть ожидала `varchar(64)`. Первая попытка исправить через `@Column(columnDefinition = "char(64)")` не сработала: в режиме `validate` Hibernate сравнивает JDBC-тип поля, а не строку `columnDefinition` | `@JdbcTypeCode(SqlTypes.CHAR)` на `RefreshToken.tokenHash`. spec §5.5 дополнен примечанием |

### Что проверено и совпадает

- **SQL ↔ Entity:** все колонки таблиц есть в сущностях spec §5.5. Ограничения, на которые ссылается `ConstraintErrorMapper`, существуют в миграциях с теми же именами (`uq_app_user_email`, `uq_member_user`, `uq_member_workspace_user`, `uq_member_workspace_seat`, `uq_template_workspace_name`, `uq_event_template_source`).
- **Entity ↔ DTO:** `EventResponse.source` ↔ `EventSource` ↔ три колонки `source_*`; `MemberResponse.seat` ↔ `workspace_member.seat`; `TemplateApplicationResponse` ↔ все колонки `template_application`.
- **DTO ↔ API:** каждый DTO из сводки spec §8.1 определён в §8.2–§8.9. Каждый код ошибки из таблиц эндпоинтов есть в каталоге §7.4, и наоборот.
- **Решения аудита ↔ spec:**
  - единственная пессимистическая блокировка — §9.5, §11;
  - join без блокировки — §9.6;
  - окно ротации 10 с — §10.4, §12.2;
  - PostgreSQL 18 — §1, §12.3, §14.1;
  - Boot 4.1.2 без других вариантов — §1, §12.1.
- **Решения Q-1…Q-6** (отчёт §6) отражены в spec §2.2: D-4 ↔ Q-1, D-5 ↔ Q-2, D-6 ↔ Q-3, D-7 ↔ Q-4, D-1 ↔ Q-6; Q-5 — spec §1.
- **Покрытие:** все 27 эндпоинтов есть в матрице выше. Все правила из spec §14.6 привязаны к тестам, а тесты — к задачам roadmap.
