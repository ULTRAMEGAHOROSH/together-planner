package com.togetherplanner.testsupport;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Очистка БД между тестами (spec §14.1): {@code TRUNCATE … CASCADE} всех
 * таблиц, кроме {@code flyway_schema_history}. Список таблиц читается из
 * {@code pg_tables}, а не хранится статически, — он растёт с каждой новой
 * миграцией, и ручной список быстро устареет.
 */
@Component
@RequiredArgsConstructor
public class DatabaseCleaner {

    private final JdbcTemplate jdbcTemplate;

    public void clean() {
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'flyway_schema_history'",
                String.class);
        if (tables.isEmpty()) {
            return;
        }
        String joined = tables.stream().map(t -> "\"" + t + "\"").collect(Collectors.joining(", "));
        jdbcTemplate.execute("TRUNCATE TABLE " + joined + " CASCADE");
    }
}
