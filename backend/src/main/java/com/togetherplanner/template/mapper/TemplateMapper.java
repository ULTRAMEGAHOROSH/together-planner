package com.togetherplanner.template.mapper;

import com.togetherplanner.template.dto.TemplateApplicationResponse;
import com.togetherplanner.template.dto.TemplateEventResponse;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.template.entity.TemplateApplication;
import com.togetherplanner.template.entity.TemplateEvent;
import com.togetherplanner.template.entity.WeekTemplate;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Component
public class TemplateMapper {

    /** {@code events} — по {@code (dayOfWeek, startTime)} (spec §8.7), а не по порядку в коллекции. */
    public TemplateResponse toResponse(WeekTemplate template, TemplateApplication lastApplication) {
        List<TemplateEventResponse> events = template.getEvents().stream()
                .sorted(Comparator.comparing(TemplateEvent::getDayOfWeek).thenComparing(TemplateEvent::getStartTime))
                .map(this::toEventResponse)
                .toList();
        return new TemplateResponse(template.getId(), template.getName(), template.getDescription(), events,
                lastApplication == null ? null : toApplicationResponse(lastApplication),
                template.getCreatedAt(), template.getUpdatedAt(), template.getVersion());
    }

    public TemplateEventResponse toEventResponse(TemplateEvent event) {
        return new TemplateEventResponse(event.getId(), event.getTitle(), event.getDescription(),
                event.getDayOfWeek(), event.getStartTime(), event.getDurationMinutes(),
                Set.copyOf(event.getParticipantIds()), event.getCategory(), event.getColor());
    }

    public TemplateApplicationResponse toApplicationResponse(TemplateApplication application) {
        return new TemplateApplicationResponse(application.getId(), application.getTemplateId(), application.getTemplateName(),
                application.getWeekStart(), application.getMode(), application.getCreatedCount(),
                application.getSkippedCount(), application.getDeletedCount(), application.getAppliedBy(), application.getAppliedAt());
    }
}
