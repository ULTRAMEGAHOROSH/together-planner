import type { IsoDate, Uuid } from '@core/api/models/common.models';
import { dateLong, WEEKDAYS_SHORT } from '@shared/time/format-ru';
import { addDays, isoDayOfWeek } from '@shared/time/week';
import { splitIntoDaySegments } from './day-segments';
import { toBox } from './geometry';
import { assignLanes } from './lanes';
import type { DayColumnLayout, DayRange, PanelLayout, Segment, TimelineEvent } from './model';

export interface PanelLayoutOptions {
  /** «Today» in the workspace zone (`ZoneClock`); `null` — no today column (template preview). */
  readonly today: IsoDate | null;
}

/**
 * The entry point of the engine for stores (FD-50, §8.1): events of the board (from
 * `toTimelineEvents`) → one member's panel over the range. Day segments, lanes and
 * geometry are internal steps.
 */
export function buildPanelLayout(
  events: readonly TimelineEvent[],
  range: DayRange,
  personId: Uuid,
  { today }: PanelLayoutOptions,
): PanelLayout {
  const byDay: Segment[][] = Array.from({ length: range.dayCount }, () => []);
  for (const segment of splitIntoDaySegments(events, range, personId)) {
    byDay[segment.dayIndex].push(segment);
  }
  const days = byDay.map((segments, index): DayColumnLayout => {
    const date = addDays(range.firstDay, index);
    const dayOfWeek = isoDayOfWeek(date);
    return {
      date,
      weekdayShort: WEEKDAYS_SHORT[dayOfWeek - 1],
      dayOfMonth: Number(date.slice(8, 10)),
      dateLabel: dateLong(date),
      isToday: date === today,
      isWeekend: dayOfWeek >= 6,
      boxes: assignLanes(segments).map((segment) => toBox(segment)),
    };
  });
  return { personId, days };
}
