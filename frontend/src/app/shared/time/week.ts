// Calendar days and weeks on ISO dates ("YYYY-MM-DD"). A week runs from Monday 00:00
// to the next Monday 00:00 (spec §3, rule 5).
import type { IsoDate } from '@core/api/models/common.models';
import { DAY_MINUTES, formatDate, parseDate } from './local-date-time';

/** ISO day number: 1 = Monday … 7 = Sunday. */
export type IsoDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function dayIndex(date: IsoDate): number {
  return parseDate(date) / DAY_MINUTES;
}

export function isoDayOfWeek(date: IsoDate): IsoDayOfWeek {
  // 1970-01-01 (day 0) was a Thursday (4).
  return (((((dayIndex(date) + 3) % 7) + 7) % 7) + 1) as IsoDayOfWeek;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isInteger(days)) {
    throw new RangeError(`Invalid day count: ${days}`);
  }
  return formatDate(parseDate(date) + days * DAY_MINUTES);
}

export function isMonday(date: IsoDate): boolean {
  return isoDayOfWeek(date) === 1;
}

/** The Monday of the week that contains `date`. */
export function weekStartOf(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoDayOfWeek(date));
}

/** The 7 dates Monday…Sunday of the week. `weekStart` must be a Monday. */
export function weekDays(weekStart: IsoDate): IsoDate[] {
  if (!isMonday(weekStart)) {
    throw new RangeError(`Week must start on Monday: ${JSON.stringify(weekStart)}`);
  }
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return dayIndex(to) - dayIndex(from);
}
