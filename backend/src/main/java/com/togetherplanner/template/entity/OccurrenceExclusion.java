package com.togetherplanner.template.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** spec §5.5. Таблица {@code template_occurrence_exclusion} (spec §5.4). Заполняется в этапе 7.2. */
@Entity
@Table(name = "template_occurrence_exclusion")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OccurrenceExclusion {

    @EmbeddedId
    private OccurrenceExclusionId id;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public OccurrenceExclusion(OccurrenceExclusionId id, UUID createdBy, Instant createdAt) {
        this.id = id;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof OccurrenceExclusion other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
