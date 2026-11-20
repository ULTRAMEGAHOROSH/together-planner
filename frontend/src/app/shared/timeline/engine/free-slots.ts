// «Оба свободны» (WEEK-15, OQ-4: the prototype's parameters). The only place of the numbers:
// the window of the day, the shortest interval and the heights at which the labels fit.
import type { IsoDate } from '@core/api/models/common.models';
import { parseDate } from '@shared/time/local-date-time';
import { formatTime } from '@shared/time/local-date-time';
import { PX_PER_MIN } from './constants';
import type { FreeSlotBox, TimelineEvent } from './model';

/** The window of the day that is looked at: 07:00–23:00. */
export const FREE_WINDOW_START = 7 * 60;
export const FREE_WINDOW_END = 23 * 60;
/** A gap shorter than this is not shown. */
export const FREE_MIN_MINUTES = 30;
/** Card heights (px) from which the label «Оба свободны» and the time fit. */
export const FREE_LABEL_MIN_HEIGHT = 30;
export const FREE_TIME_MIN_HEIGHT = 44;

/** Minutes since midnight of one free interval, half-open. */
export interface FreeInterval {
  readonly start: number;
  readonly end: number;
}

/**
 * The gaps of `date` inside the window in which nobody has an event. `events` are the events
 * of both members (a joint one counts once); anything outside the window is clipped, so a
 * night's sleep never reaches the window.
 */
export function freeIntervals(events: readonly TimelineEvent[], date: IsoDate): FreeInterval[] {
  const dayStart = parseDate(date);
  const from = dayStart + FREE_WINDOW_START;
  const to = dayStart + FREE_WINDOW_END;
  const busy = events
    .filter((e) => e.startMin < to && e.endMin > from)
    .map((e) => [Math.max(e.startMin, from), Math.min(e.endMin, to)] as const)
    .sort((a, b) => a[0] - b[0]);
  const free: FreeInterval[] = [];
  let cursor = from;
  for (const [start, end] of busy) {
    if (start - cursor >= FREE_MIN_MINUTES) {
      free.push({ start: cursor - dayStart, end: start - dayStart });
    }
    cursor = Math.max(cursor, end);
  }
  if (to - cursor >= FREE_MIN_MINUTES) {
    free.push({ start: cursor - dayStart, end: to - dayStart });
  }
  return free;
}

/** The ready-to-draw boxes of the free gaps of one day (prototype `freeSlots`). */
export function freeSlotBoxes(events: readonly TimelineEvent[], date: IsoDate): FreeSlotBox[] {
  return freeIntervals(events, date).map(({ start, end }) => {
    const height = Math.round((end - start) * PX_PER_MIN) - 2;
    return {
      key: `f${start}`,
      top: Math.round(start * PX_PER_MIN) + 1,
      height,
      timeLabel: `${formatTime(start)}–${formatTime(end)}`,
      showLabel: height >= FREE_LABEL_MIN_HEIGHT,
      showTime: height >= FREE_TIME_MIN_HEIGHT,
    };
  });
}
