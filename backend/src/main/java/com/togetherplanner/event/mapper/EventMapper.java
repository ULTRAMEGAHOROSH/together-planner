package com.togetherplanner.event.mapper;

import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.dto.EventSourceResponse;
import com.togetherplanner.event.entity.Event;
import com.togetherplanner.event.entity.EventSource;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class EventMapper {

    public EventResponse toResponse(Event event) {
        return new EventResponse(
                event.getId(), event.getTitle(), event.getDescription(),
                event.getStartLocal(), event.getEndLocal(),
                Set.copyOf(event.getParticipantIds()),
                event.getCategory(), event.getColor(),
                toSourceResponse(event.getSource()),
                event.getCreatedBy(), event.getUpdatedBy(),
                event.getCreatedAt(), event.getUpdatedAt(),
                event.getVersion());
    }

    private EventSourceResponse toSourceResponse(EventSource source) {
        if (source == null) {
            return null;
        }
        return new EventSourceResponse(source.getTemplateEventId(), source.getWeekStart(), source.getTemplateName());
    }
}
