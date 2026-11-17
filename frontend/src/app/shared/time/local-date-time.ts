// Local date-time arithmetic without the browser time zone (FD-30…32).
//
// The backend stores event times as wall-clock time of the workspace, without a zone
// (spec §3). Here they become integer "local minutes": minutes since 1970-01-01T00:00
// on a calendar where every day has exactly 1440 minutes. UTC is used only as that
// counting scale (`Date.UTC`), never as a time zone. This is the only file that turns
// strings into numbers and back; everything else works with LocalMinutes or ISO strings.
import type { IsoDate, IsoLocalDateTime, IsoTime } from '@core/api/models/common.models';

/** Minutes since 1970-01-01T00:00 on the local calendar (may be negative). */
export type LocalMinutes = number;

export const DAY_MINUTES = 1440;
const MS_PER_MINUTE = 60_000;

export interface LocalDateTimeParts {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** 0–23 */
  hour: number;
  /** 0–59 */
  minute: number;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// HH:mm, HH:mm:ss or HH:mm:ss.f…f (1–9 digits). Seconds are accepted and dropped:
// events and templates have minute precision.
const TIME = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/;

function invalid(kind: string, value: unknown): never {
  throw new RangeError(`Invalid ${kind}: ${JSON.stringify(value)}`);
}

function assertMinutes(minutes: number): void {
  if (!Number.isSafeInteger(minutes)) {
    invalid('local minutes', minutes);
  }
}

/** Builds local minutes from calendar parts. Throws RangeError for impossible dates (31.02). */
export function toLocalMinutes(parts: LocalDateTimeParts): LocalMinutes {
  const { year, month, day, hour, minute } = parts;
  const valid =
    [year, month, day, hour, minute].every(Number.isInteger) &&
    year >= 1000 && // Date.UTC maps years 0–99 to 1900–1999
    year <= 9999 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month);
  if (!valid) {
    invalid('local date-time parts', parts);
  }
  return Date.UTC(year, month - 1, day, hour, minute) / MS_PER_MINUTE;
}

export function fromLocalMinutes(minutes: LocalMinutes): LocalDateTimeParts {
  assertMinutes(minutes);
  const date = new Date(minutes * MS_PER_MINUTE);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "2026-11-20T08:00", "…T08:00:00" or "…T08:00:00.000" → local minutes (FD-32). */
export function parseLocalDateTime(value: string): LocalMinutes {
  const [date, time, ...rest] = value.split('T');
  if (date === undefined || time === undefined || rest.length > 0) {
    invalid('local date-time', value);
  }
  try {
    return parseDate(date) + parseTime(time);
  } catch {
    return invalid('local date-time', value);
  }
}

/** Always "YYYY-MM-DDTHH:mm" — the format the frontend sends (FD-32). */
export function formatLocalDateTime(minutes: LocalMinutes): IsoLocalDateTime {
  return `${formatDate(minutes)}T${formatTime(minutesOfDay(minutes))}`;
}

/** "2026-11-20" → local minutes of its midnight. */
export function parseDate(value: string): LocalMinutes {
  const match = DATE.exec(value);
  if (!match) {
    invalid('date', value);
  }
  const [, year, month, day] = match.map(Number);
  try {
    return toLocalMinutes({ year, month, day, hour: 0, minute: 0 });
  } catch {
    return invalid('date', value);
  }
}

/** The date ("YYYY-MM-DD") the given minute belongs to. */
export function formatDate(minutes: LocalMinutes): IsoDate {
  const { year, month, day } = fromLocalMinutes(minutes);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "08:00", "08:00:00" or "08:00:00.000" → minutes since midnight (0–1439). */
export function parseTime(value: string): number {
  const match = TIME.exec(value);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  const second = Number(match?.[3] ?? 0);
  if (!match || hour > 23 || minute > 59 || second > 59) {
    invalid('time', value);
  }
  return hour * 60 + minute;
}

/** Minutes since midnight (0–1439) → "HH:mm" — the format the frontend sends for IsoTime. */
export function formatTime(minutesSinceMidnight: number): IsoTime {
  if (
    !Number.isInteger(minutesSinceMidnight) ||
    minutesSinceMidnight < 0 ||
    minutesSinceMidnight >= DAY_MINUTES
  ) {
    invalid('minutes since midnight', minutesSinceMidnight);
  }
  return `${pad(Math.floor(minutesSinceMidnight / 60))}:${pad(minutesSinceMidnight % 60)}`;
}

/** Position inside the day: 0–1439. */
export function minutesOfDay(minutes: LocalMinutes): number {
  assertMinutes(minutes);
  return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

/** Local minutes of the midnight that starts the day containing `minutes`. */
export function dateOfMinutes(minutes: LocalMinutes): LocalMinutes {
  return minutes - minutesOfDay(minutes);
}

/** Comparator for local date-time strings in any accepted format: negative, 0 or positive. */
export function compareLocal(a: string, b: string): number {
  return parseLocalDateTime(a) - parseLocalDateTime(b);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
