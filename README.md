# Together Planner

Приложение для двоих: общая неделя, события, шаблоны. Backend — модульный монолит: Java 21, Spring Boot 4.1.2,
Spring Security (JWT), Spring Data JPA/Hibernate, PostgreSQL 18, Flyway.

## Требования

- JDK 21 (например, Eclipse Temurin 21).
- Docker и Docker Compose (для PostgreSQL и для тестов — они поднимают базу через Testcontainers).

Отдельно устанавливать Maven не нужно — в репозитории есть `mvnw`/`mvnw.cmd` (Maven Wrapper).

## Переменные окружения

Конфигурация читается из `.env` в корне репозитория (работает и при запуске
из корня, и при запуске из `backend/`). Шаблон — `.env.example`:

```
POSTGRES_DB=together
POSTGRES_USER=together
POSTGRES_PASSWORD=change-me
DB_URL=jdbc:postgresql://localhost:5432/together
JWT_SECRET=                       # openssl rand -base64 48
REFRESH_COOKIE_SECURE=true
SWAGGER_ENABLED=true
```

Перед первым запуском:

```bash
cp .env.example .env
```

и заполнить `JWT_SECRET` (например, `openssl rand -base64 48`). Для локальной
разработки по HTTP (без TLS) можно поставить `REFRESH_COOKIE_SECURE=false` —
иначе браузер не будет сохранять cookie с refresh-токеном. Сам `.env` в git
не попадает (см. `.gitignore`).

## Запуск базы данных

```bash
docker compose up -d postgres
```

Поднимет PostgreSQL 18 на `localhost:5432` с данными из `.env`. Миграции
Flyway накатываются самим backend-приложением при старте.

## Запуск backend

**Вариант А — локально, из IDE или Maven (БД уже поднята выше):**

```bash
cd backend
./mvnw spring-boot:run
```

**Вариант Б — целиком в Docker** (поднимает и БД, и backend одной командой):

```bash
docker compose --profile app up --build
```

В обоих случаях backend слушает `http://localhost:8080`. Проверка, что всё
поднялось:

```bash
curl http://localhost:8080/actuator/health
# {"groups":["liveness","readiness"],"status":"UP"}
```

## Swagger / OpenAPI

- Swagger UI: http://localhost:8080/swagger-ui.html
- Спецификация OpenAPI (JSON): http://localhost:8080/v3/api-docs

Через Swagger UI можно, например, зарегистрироваться (`POST /auth/register`)
и дальше пройти остальные эндпоинты с полученным `accessToken`.

## Тесты backend

```bash
cd backend
./mvnw clean verify
```

Интеграционные тесты (`*IT`) поднимают PostgreSQL через Testcontainers
автоматически — Docker должен быть запущен, отдельно поднимать
`docker compose up -d postgres` для тестов не нужно (и не мешает, если он уже
поднят).

## Frontend

Angular 22 (standalone, signals), Angular CDK, vitest, Playwright. Код — `frontend/`.

**Требования:** Node.js 24 (npm 11), поднятый backend на `localhost:8080` (см. выше).
Для E2E — Chrome (Playwright использует установленный канал Chrome).

```bash
cd frontend
npm ci
npm start            # http://localhost:4200, /api проксируется на :8080 (proxy.conf.json)
```

Проверки:

```bash
npm test             # unit-тесты (vitest)
npm run lint
npm run format:check
npm run build        # production-сборка в dist/, бюджеты размера проверяются
npm run e2e          # Playwright против реального backend на :8080; dev-сервер поднимается сам
```

E2E создаёт своих пользователей (`e2e-<run>-<n>@example.test`) и ничего не чистит.
Против собранного образа: `E2E_BASE_URL=http://localhost:8081 npm run e2e` (nginx ограничивает
запросы к `/api/v1/auth/` — 20 в минуту на адрес, полный набор подряд не пройдёт; подробности —
в руководстве по разработке).

**Всё в Docker** (PostgreSQL, backend и frontend за nginx — один origin, CSP и кеш-заголовки):

```bash
docker compose --profile app up --build
```

Приложение — `http://localhost:8081`. Порт `8080` backend нужен только для разработки,
в production его не публикуют. За HTTPS оставьте `REFRESH_COOKIE_SECURE=true`;
`false` — только для локального HTTP.

## Структура репозитория

- `backend/` — исходный код и тесты (Maven-проект, модульный монолит).
- `frontend/` — Angular-приложение, тесты и E2E (`frontend/e2e`), nginx-конфиг для образа.
- `docker-compose.yml`, `backend/Dockerfile` — инфраструктура (§12.3 спецификации).
