import { inject } from '@angular/core';
import { SessionStore } from '@core/auth/session-store';
import { ZoneClock } from '@core/time/zone-clock';
import { weekStartOf } from '@shared/time';

/**
 * `/week/<Monday of the current week>`: «today» is counted in the workspace zone (FD-33),
 * not the browser's. For `redirectTo` and for a malformed address; injection context.
 * Without a workspace (it cannot happen inside the shell) — UTC.
 */
export function currentWeekPath(): string {
  const zone = inject(SessionStore).timeZone() ?? 'UTC';
  return `/week/${weekStartOf(inject(ZoneClock).todayIn(zone))}`;
}
