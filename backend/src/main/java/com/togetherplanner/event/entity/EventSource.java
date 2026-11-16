package com.togetherplanner.event.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

/**
 * spec §5.5. Метка происхождения, без FK на шаблон (R-7: правка шаблона не
 * меняет уже созданных недель). Неизменяема — {@code source} у события не
 * меняется после создания (spec §8.6, E5).
 *
 * <p>Если все три колонки {@code NULL}, Hibernate загружает {@code source}
 * как {@code null} — стандартное поведение для embeddable без примитивов.
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
