package com.togetherplanner.testsupport;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Wipes the database between tests: {@code TRUNCATE ... CASCADE} on every
 * table except {@code flyway_schema_history}. The table list is read
 * from {@code pg_tables} rather than hardcoded - it grows with every new
 * migration, and a hardcoded list would go stale fast.
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
