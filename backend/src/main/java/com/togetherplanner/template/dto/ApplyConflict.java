package com.togetherplanner.template.dto;

import com.togetherplanner.event.dto.EventResponse;

/** Вхождение будет создано, но пересекается с существующим событием общего участника — предупреждение, не ошибка. */
public record ApplyConflict(PlannedEvent planned, EventResponse existing) {
}
