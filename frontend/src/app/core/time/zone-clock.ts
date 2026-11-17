// "Now" and "today" in the workspace time zone, not the browser's (FD-33): if the laptop
// is in another zone, "today" must match what the partner sees and what the backend
// counts (E2, S1). The moment comes from CLOCK, so tests always use a fixed time.
import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import type { IsoDate } from '../api/models/common.models';
import { formatDate, type LocalMinutes, toLocalMinutes } from '@shared/time';

/** Current instant in epoch milliseconds. Override in tests with a fixed value. */
export const CLOCK = new InjectionToken<() => number>('CLOCK', {
  providedIn: 'root',
  // Read Date.now lazily, so fake timers installed later are respected.
  factory: () => () => Date.now(),
});

const MINUTE_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class ZoneClock {
  private readonly clock = inject(CLOCK);
  private readonly formatters = new Map<string, Intl.DateTimeFormat>();
  private readonly tick = signal(this.clock());
  private timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * The current instant, updated on every minute boundary. Read it in a `computed`
   * to recalculate once a minute: `computed(() => clock.nowIn(zone, clock.minuteTick()))`.
   */
  readonly minuteTick = this.tick.asReadonly();

  constructor() {
    this.schedule();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** Wall-clock time in `zone` (IANA region id) at `instant` (default: now). */
  nowIn(zone: string, instant: number = this.clock()): LocalMinutes {
    const parts = new Map(
      this.formatterFor(zone)
        .formatToParts(instant)
        .map((part) => [part.type, Number(part.value)]),
    );
    // A missing part becomes NaN, and toLocalMinutes rejects it.
    return toLocalMinutes({
      year: Number(parts.get('year')),
      month: Number(parts.get('month')),
      day: Number(parts.get('day')),
      hour: Number(parts.get('hour')),
      minute: Number(parts.get('minute')),
    });
  }

  /** The date in `zone` at `instant` (default: now). */
  todayIn(zone: string, instant: number = this.clock()): IsoDate {
    return formatDate(this.nowIn(zone, instant));
  }

  private formatterFor(zone: string): Intl.DateTimeFormat {
    let formatter = this.formatters.get(zone);
    if (!formatter) {
      // en-CA + h23: numeric parts, midnight is "00" (never "24"). Throws for an unknown zone.
      formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      this.formatters.set(zone, formatter);
    }
    return formatter;
  }

  /** Re-aligned on every tick: a timer delayed by a sleeping laptop catches up. */
  private schedule(): void {
    const delay = MINUTE_MS - (this.clock() % MINUTE_MS);
    this.timer = setTimeout(() => {
      this.tick.set(this.clock());
      this.schedule();
    }, delay);
  }
}
