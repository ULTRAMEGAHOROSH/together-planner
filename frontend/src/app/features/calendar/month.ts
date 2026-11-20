// The month of the calendar (CAL-01): its address `YYYY-MM` and the grid of days that
// shows it. Pure date arithmetic on `@shared/time`, no clock and no state.
import type { IsoDate } from '@core/api/models/common.models';
import { EVENT_YEAR_MAX, EVENT_YEAR_MIN } from '@shared/domain';
import { addDays, monthTitle, weekStartOf } from '@shared/time';

/** `2026-11`: a month in the `?month=` of the address. */
export type IsoMonth = string;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The same years as events may have (spec §8.6), so the grid never asks for a year the API refuses. */
export function isMonth(value: string): boolean {
  const match = MONTH.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  return year >= EVENT_YEAR_MIN && year <= EVENT_YEAR_MAX;
}

/** The month a date belongs to. */
export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

/** The first day of the month. */
export function firstOfMonth(month: IsoMonth): IsoDate {
  return `${month}-01`;
}

/** The month `count` months away (negative — back). */
export function shiftMonth(month: IsoMonth, count: number): IsoMonth {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + count;
  const shiftedYear = Math.floor(index / 12);
  return `${shiftedYear}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** «Ноябрь 2026». */
export function monthLabel(month: IsoMonth): string {
  return monthTitle(firstOfMonth(month));
}

/** `/calendar?month=2026-11`. */
export function calendarUrl(month: IsoMonth): string {
  return `/calendar?month=${month}`;
}

/** The month of the address: what was asked for if it is a month, else `current` (replaced). */
export function resolveMonth(
  raw: string | undefined,
  current: IsoMonth,
): { readonly month: IsoMonth; readonly canonical: boolean } {
  return raw !== undefined && isMonth(raw)
    ? { month: raw, canonical: true }
    : { month: current, canonical: false };
}

/** The days on screen: whole weeks from the Monday of the week of the 1st (prototype `vCal`). */
export interface MonthGrid {
  readonly month: IsoMonth;
  /** 35 or 42 days: six weeks only when the sixth is still in the month. */
  readonly days: readonly IsoDate[];
}

export function monthGrid(month: IsoMonth): MonthGrid {
  const first = weekStartOf(firstOfMonth(month));
  const count = monthOf(addDays(first, 35)) === month ? 42 : 35;
  return { month, days: Array.from({ length: count }, (_, i) => addDays(first, i)) };
}
