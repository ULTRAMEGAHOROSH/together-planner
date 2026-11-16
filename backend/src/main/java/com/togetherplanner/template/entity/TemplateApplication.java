package com.togetherplanner.template.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** spec §5.5. Таблица {@code template_application} (spec §5.4) — журнал. Заполняется в этапе 7. */
@Entity
@Table(name = "template_application")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TemplateApplication {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    /** {@code NULL} после удаления шаблона (spec T5, ON DELETE SET NULL). */
    @Column(name = "template_id")
    private UUID templateId;

    @Column(name = "template_name", nullable = false, length = 60)
    private String templateName;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private ApplyMode mode;

    @Column(name = "created_count", nullable = false)
    private int createdCount;

    @Column(name = "skipped_count", nullable = false)
    private int skippedCount;

    @Column(name = "deleted_count", nullable = false)
    private int deletedCount;

    @Column(name = "applied_by", nullable = false)
    private UUID appliedBy;

    @Column(name = "applied_at", nullable = false)
    private Instant appliedAt;

    public TemplateApplication(UUID workspaceId, UUID templateId, String templateName, LocalDate weekStart,
                                ApplyMode mode, int createdCount, int skippedCount, int deletedCount,
                                UUID appliedBy, Instant appliedAt) {
        this.workspaceId = workspaceId;
        this.templateId = templateId;
        this.templateName = templateName;
        this.weekStart = weekStart;
        this.mode = mode;
        this.createdCount = createdCount;
        this.skippedCount = skippedCount;
        this.deletedCount = deletedCount;
        this.appliedBy = appliedBy;
        this.appliedAt = appliedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof TemplateApplication other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
