import { inject } from '@angular/core';
import { SessionStore } from '@core/auth/session-store';
import { ZoneClock } from '@core/time/zone-clock';
import type { IsoDate } from '@core/api/models/common.models';
import { weekStartOf } from '@shared/time';

/** The Monday of the week that holds «today» in `zone` (`null` — UTC) at `instant` (now). */
export function currentWeekStart(zone: string | null, clock: ZoneClock, instant?: number): IsoDate {
  return weekStartOf(clock.todayIn(zone ?? 'UTC', instant));
}

/**
 * `/week/<Monday of the current week>`: «today» is counted in the workspace zone (FD-33),
 * not the browser's. For `redirectTo` and for a malformed address; injection context.
 * Without a workspace (it cannot happen inside the shell) — UTC.
 */
export function currentWeekPath(): string {
  return `/week/${currentWeekStart(inject(SessionStore).timeZone(), inject(ZoneClock))}`;
}
