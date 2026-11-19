import type { EventResponse } from '@core/api/models/event.models';
import { colorKeyOf } from '@shared/domain/category-palette';
import { parseLocalDateTime } from '@shared/time/local-date-time';
import type { TimelineEvent } from './model';

/** The only DTO → engine conversion (FD-51): local minutes, resolved color, flags. */
export function toTimelineEvents(events: readonly EventResponse[]): TimelineEvent[] {
  return events.map(toTimelineEvent);
}

export function toTimelineEvent(event: EventResponse): TimelineEvent {
  return {
    id: event.id,
    title: event.title,
    startMin: parseLocalDateTime(event.start),
    endMin: parseLocalDateTime(event.end),
    participantIds: [...event.participantIds],
    category: event.category,
    color: colorKeyOf(event),
    joint: event.participantIds.length > 1,
    fromTemplate: event.source !== null,
  };
}
