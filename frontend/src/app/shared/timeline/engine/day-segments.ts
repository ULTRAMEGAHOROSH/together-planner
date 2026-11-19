import type { Uuid } from '@core/api/models/common.models';
import { formatDate, parseDate } from '@shared/time/local-date-time';
import { DAY_MINUTES } from './constants';
import type { DayRange, Segment, TimelineEvent } from './model';

/**
 * Cuts the events of one member into per-day segments of the range (FD-53). Intervals are
 * half-open: an event ending at 00:00 does not reach the next day, one starting at 00:00
 * does not touch the previous one. Parts outside the range are dropped; the flags tell
 * whether the event goes on before or after the day, even beyond the range.
 * Order: input order of the events, days ascending within an event.
 */
export function splitIntoDaySegments(
  events: readonly TimelineEvent[],
  range: DayRange,
  personId: Uuid,
): Segment[] {
  const rangeStart = parseDate(range.firstDay);
  const segments: Segment[] = [];
  for (const event of events) {
    if (!event.participantIds.includes(personId)) continue;
    // Days of the range the event touches: [first; last], clamped to the range.
    const first = Math.max(0, Math.floor((event.startMin - rangeStart) / DAY_MINUTES));
    const last = Math.min(
      range.dayCount - 1,
      Math.ceil((event.endMin - rangeStart) / DAY_MINUTES) - 1,
    );
    for (let dayIndex = first; dayIndex <= last; dayIndex++) {
      const dayStart = rangeStart + dayIndex * DAY_MINUTES;
      const dayEnd = dayStart + DAY_MINUTES;
      segments.push({
        event,
        date: formatDate(dayStart),
        dayIndex,
        start: Math.max(event.startMin, dayStart) - dayStart,
        end: Math.min(event.endMin, dayEnd) - dayStart,
        continuesBefore: event.startMin < dayStart,
        continuesAfter: event.endMin > dayEnd,
      });
    }
  }
  return segments;
}
