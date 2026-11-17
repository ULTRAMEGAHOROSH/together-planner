# Together Planner — backend

Backend модульного монолита «Together Planner»: Java 21, Spring Boot 4.1.2,
Spring Security (JWT), Spring Data JPA/Hibernate, PostgreSQL 18, Flyway.
Полная спецификация — [docs/backend-spec-v2.md](docs/backend-spec-v2.md),
план реализации по этапам — [docs/backend-implementation-roadmap.md](docs/backend-implementation-roadmap.md).

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

## Тесты

```bash
cd backend
./mvnw clean verify
```

Интеграционные тесты (`*IT`) поднимают PostgreSQL через Testcontainers
автоматически — Docker должен быть запущен, отдельно поднимать
`docker compose up -d postgres` для тестов не нужно (и не мешает, если он уже
поднят).

## Структура репозитория

- `backend/` — исходный код и тесты (Maven-проект; модульный монолит —
  границы модулей описаны в [docs/backend-spec-v2.md](docs/backend-spec-v2.md), §6).
- `docs/` — спецификация, аудит и план реализации.
- `docker-compose.yml`, `backend/Dockerfile` — инфраструктура (§12.3 спецификации).
