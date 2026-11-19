import type { IsoDate } from '@core/api/models/common.models';
import { addDays, daysBetween, isMonday, parseDate, weekStartOf } from '@shared/time';

/** Where the week page is: a week and, in the «День» mode, a day of it. */
export interface WeekAddress {
  readonly weekStart: IsoDate;
  /** `null` — the whole week. */
  readonly day: IsoDate | null;
}

/** `/week/2026-11-09` or `/week/2026-11-09?day=2026-11-12`. */
export function weekUrl({ weekStart, day }: WeekAddress): string {
  return day === null ? `/week/${weekStart}` : `/week/${weekStart}?day=${day}`;
}

function isDate(value: string): boolean {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
}

/** `day` is a date of the week that starts on `weekStart`. */
function isDayOfWeek(day: string, weekStart: IsoDate): boolean {
  if (!isDate(day)) {
    return false;
  }
  const offset = daysBetween(weekStart, day);
  return offset >= 0 && offset <= 6;
}

export interface ResolvedAddress {
  /** The address the page shows: what was asked for, put right. */
  readonly address: WeekAddress;
  /** The URL already is `address`: nothing to replace. */
  readonly canonical: boolean;
}

/**
 * The address of `/week/:weekStart?day=` as the page shows it (FD §6): the week is always
 * its Monday (any other day → its Monday, not a date → `currentWeek`); `day` stays only if
 * it is a date of that week.
 */
export function resolveAddress(
  rawWeek: string,
  rawDay: string | undefined,
  currentWeek: IsoDate,
): ResolvedAddress {
  const weekStart = !isDate(rawWeek)
    ? currentWeek
    : isMonday(rawWeek)
      ? rawWeek
      : weekStartOf(rawWeek);
  const day = rawDay !== undefined && isDayOfWeek(rawDay, weekStart) ? rawDay : null;
  return {
    address: { weekStart, day },
    canonical: rawWeek === weekStart && rawDay === (day ?? undefined),
  };
}

/** The same day one step (`days`, ±1) away; it may be in the next or the previous week. */
export function shiftDay(day: IsoDate, days: number): WeekAddress {
  const next = addDays(day, days);
  return { weekStart: weekStartOf(next), day: next };
}
