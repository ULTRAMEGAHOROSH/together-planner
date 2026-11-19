import {
  formatDate,
  formatTime,
  type LocalMinutes,
  minutesOfDay,
} from '@shared/time/local-date-time';
import { PX_PER_MIN } from './constants';
import type { NowMark } from './model';

/**
 * «Now» of the workspace (local minutes, from `ZoneClock`) → where the red line goes
 * (prototype: `top = round(minutes since midnight × px per minute)`) and what its label says.
 * Pure: the clock is read by the caller.
 */
export function nowMark(now: LocalMinutes, pxPerMin = PX_PER_MIN): NowMark {
  const minute = minutesOfDay(now);
  return { date: formatDate(now), top: Math.round(minute * pxPerMin), label: formatTime(minute) };
}

/** Same place and text: the board does not redraw the line for an equal mark. */
export function sameNowMark(a: NowMark | null, b: NowMark | null): boolean {
  return (
    a === b ||
    (a !== null && b !== null && a.date === b.date && a.top === b.top && a.label === b.label)
  );
}
