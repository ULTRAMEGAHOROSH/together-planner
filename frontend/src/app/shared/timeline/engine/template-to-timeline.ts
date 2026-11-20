import type { Uuid } from '@core/api/models/common.models';
import type { EventCategory, EventColor } from '@core/api/models/enums';
import { DAYS_OF_WEEK, type DayOfWeek } from '@core/api/models/enums';
import { colorKeyOf } from '@shared/domain/category-palette';
import { DAY_MINUTES, parseDate, parseTime } from '@shared/time/local-date-time';
import type { IsoDate } from '@core/api/models/common.models';
import type { TimelineEvent } from './model';

/** A Monday that belongs to no real week: the conditional week of a template (display only). */
export const TEMPLATE_WEEK_START: IsoDate = '2001-01-01';
const WEEK_MINUTES = 7 * DAY_MINUTES;

/** What the preview needs of a template event (a response row or a row of the form). */
export interface TemplatePreviewEvent {
  readonly id: Uuid;
  readonly title: string;
  readonly dayOfWeek: DayOfWeek;
  /** `HH:mm`. */
  readonly startTime: string;
  readonly durationMinutes: number;
  readonly participantIds: readonly Uuid[];
  readonly category: EventCategory;
  readonly color: EventColor | null;
}

/**
 * Template events laid on the conditional week (FD: display only, the backend plans a real
 * application). An event that runs past Sunday midnight continues on Monday of the same
 * week: the tail is a second engine event with the same `id`. Nothing here decides what
 * T6/T7 do.
 */
export function templateToTimelineEvents(events: readonly TemplatePreviewEvent[]): TimelineEvent[] {
  const monday = parseDate(TEMPLATE_WEEK_START);
  return events.flatMap((event) => {
    const start =
      monday + DAYS_OF_WEEK.indexOf(event.dayOfWeek) * DAY_MINUTES + parseTime(event.startTime);
    const end = start + event.durationMinutes;
    const base: TimelineEvent = {
      id: event.id,
      title: event.title,
      startMin: start,
      endMin: Math.min(end, monday + WEEK_MINUTES),
      participantIds: [...event.participantIds],
      category: event.category,
      color: colorKeyOf(event),
      joint: event.participantIds.length > 1,
      fromTemplate: true,
    };
    const overflow = end - (monday + WEEK_MINUTES);
    if (overflow <= 0) return [base];
    // The tail is cut at its own start, so an event of the whole week does not meet itself.
    const tailEnd = monday + Math.min(overflow, start - monday);
    return tailEnd > monday ? [base, { ...base, startMin: monday, endMin: tailEnd }] : [base];
  });
}
