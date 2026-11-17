package com.togetherplanner.event.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/** Maps to the {@code event} table. Participants are an {@code @ElementCollection} - no need to load {@code User} rows. */
@Entity
@Table(name = "event")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Event {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(name = "start_local", nullable = false)
    private LocalDateTime startLocal;

    @Column(name = "end_local", nullable = false)
    private LocalDateTime endLocal;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EventCategory category;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private EventColor color;

    /** {@code null} means the event was created manually. Doesn't change after creation. */
    @Embedded
    private EventSource source;

    @ElementCollection
    @CollectionTable(name = "event_participant", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "user_id", nullable = false)
    private Set<UUID> participantIds = new HashSet<>();

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    public Event(UUID workspaceId, String title, String description, LocalDateTime startLocal, LocalDateTime endLocal,
                 EventCategory category, EventColor color, EventSource source, Set<UUID> participantIds,
                 UUID createdBy, Instant now) {
        this.workspaceId = workspaceId;
        this.title = title;
        this.description = description;
        this.startLocal = startLocal;
        this.endLocal = endLocal;
        this.category = category;
        this.color = color;
        this.source = source;
        this.participantIds = new HashSet<>(participantIds);
        this.createdBy = createdBy;
        this.updatedBy = createdBy;
        this.createdAt = now;
        this.updatedAt = now;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Event other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
