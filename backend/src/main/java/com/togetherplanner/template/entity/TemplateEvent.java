package com.togetherplanner.template.entity;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.entity.EventColor;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Maps to the {@code template_event} table. {@code category}/{@code color}
 * reuse the same two enums as {@code event} - no point duplicating them
 * under separate names.
 */
@Entity
@Table(name = "template_event")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TemplateEvent {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private WeekTemplate template;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 2000)
    private String description;

    // columnDefinition alone doesn't validate the type here - needs an
    // explicit @JdbcTypeCode, same as char(64) on RefreshToken.tokenHash.
    @Convert(converter = DayOfWeekConverter.class)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "day_of_week", nullable = false)
    private DayOfWeek dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private EventCategory category;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private EventColor color;

    @ElementCollection
    @CollectionTable(name = "template_event_participant", joinColumns = @JoinColumn(name = "template_event_id"))
    @Column(name = "user_id", nullable = false)
    private Set<UUID> participantIds = new HashSet<>();

    public TemplateEvent(WeekTemplate template, String title, String description, DayOfWeek dayOfWeek,
                          LocalTime startTime, int durationMinutes, EventCategory category, EventColor color,
                          Set<UUID> participantIds) {
        this.template = template;
        this.title = title;
        this.description = description;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.durationMinutes = durationMinutes;
        this.category = category;
        this.color = color;
        this.participantIds = new HashSet<>(participantIds);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof TemplateEvent other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
