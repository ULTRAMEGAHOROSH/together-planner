package com.togetherplanner.event.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Provenance marker, intentionally without an FK to the template event -
 * editing a template shouldn't change weeks already generated from it.
 * Immutable: an event's {@code source} never changes after creation.
 *
 * <p>When all three columns are {@code NULL}, Hibernate loads
 * {@code source} as {@code null} - standard behavior for an embeddable
 * with no primitive fields.
 */
@Embeddable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EventSource {

    @Column(name = "source_template_event_id")
    private UUID templateEventId;

    @Column(name = "source_week_start")
    private LocalDate weekStart;

    @Column(name = "source_template_name")
    private String templateName;

    public EventSource(UUID templateEventId, LocalDate weekStart, String templateName) {
        this.templateEventId = templateEventId;
        this.weekStart = weekStart;
        this.templateName = templateName;
    }
}
