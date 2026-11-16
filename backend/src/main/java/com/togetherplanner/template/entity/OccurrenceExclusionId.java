package com.togetherplanner.template.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/** spec §5.5. Составной ключ {@code template_occurrence_exclusion}. */
@Embeddable
public class OccurrenceExclusionId implements Serializable {

    @Column(name = "template_event_id")
    private UUID templateEventId;

    @Column(name = "week_start")
    private LocalDate weekStart;

    protected OccurrenceExclusionId() {
    }

    public OccurrenceExclusionId(UUID templateEventId, LocalDate weekStart) {
        this.templateEventId = templateEventId;
        this.weekStart = weekStart;
    }

    public UUID getTemplateEventId() {
        return templateEventId;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof OccurrenceExclusionId other)) {
            return false;
        }
        return Objects.equals(templateEventId, other.templateEventId) && Objects.equals(weekStart, other.weekStart);
    }

    @Override
    public int hashCode() {
        return Objects.hash(templateEventId, weekStart);
    }
}
