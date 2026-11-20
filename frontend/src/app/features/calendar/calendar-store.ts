// The month on screen (CAL-01, FD-25…28): loads E1 for the days of the grid, keeps the
// previous month while the next one loads, and turns events into cells. Knows neither the
// DOM nor the router: the page tells it which month to show.
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, defer, map, of, Subject, switchMap, throwError } from 'rxjs';
import { EventsApi } from '@core/api/events-api';
import type { IsoDate } from '@core/api/models/common.models';
import type { EventResponse } from '@core/api/models/event.models';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { DataChanges } from '@core/changes/data-changes';
import { ApiError, isApiError } from '@core/error/api-error';
import { ZoneClock } from '@core/time/zone-clock';
import { type IsoMonth, monthGrid, monthOf } from './month';

/** `idle` — no month was asked for yet. `loading` may come with the previous month's `data`. */
export type CalendarStatus = 'idle' | 'loading' | 'ready' | 'error';

/** What the grid shows for one day. */
export interface CalendarDay {
  readonly date: IsoDate;
  /** The day number, `1`…`31`. */
  readonly number: number;
  /** The day is in the month on screen (the grid also has days of the next and the last). */
  readonly inMonth: boolean;
  readonly isToday: boolean;
  /** Manual events that start this day, by start. */
  readonly manual: readonly EventResponse[];
  /** Events from templates that start this day. */
  readonly routine: number;
}

interface Loaded {
  readonly month: IsoMonth;
  readonly events: readonly EventResponse[];
}

@Injectable()
export class CalendarStore {
  private readonly api = inject(EventsApi);
  private readonly session = inject(SessionStore);
  private readonly workspaceRefresh = inject(WorkspaceRefresh);
  private readonly zoneClock = inject(ZoneClock);
  private readonly requests = new Subject<IsoMonth>();

  private readonly monthState = signal<IsoMonth | null>(null);
  private readonly statusState = signal<CalendarStatus>('idle');
  private readonly dataState = signal<Loaded | null>(null);
  private readonly errorState = signal<ApiError | null>(null);

  /** The month that was asked for (it may be ahead of `data` while loading). */
  readonly month = this.monthState.asReadonly();
  readonly status = this.statusState.asReadonly();
  /** The last month that arrived; kept while the next one loads. */
  readonly data = this.dataState.asReadonly();
  readonly error = this.errorState.asReadonly();

  /** «Today» in the workspace zone; changes only at midnight there. */
  readonly today = computed(() =>
    this.zoneClock.todayIn(this.session.timeZone() ?? 'UTC', this.zoneClock.minuteTick()),
  );

  /** The cells of the loaded month; empty until the first month arrives. */
  readonly days = computed<readonly CalendarDay[]>(() => {
    const data = this.dataState();
    if (data === null) {
      return [];
    }
    const grid = monthGrid(data.month);
    const today = this.today();
    // A day is the day an event starts (prototype): one that began before the grid is not
    // shown, and a night over midnight stays in the day it began.
    const byDay = new Map<IsoDate, EventResponse[]>(grid.days.map((d) => [d, []]));
    for (const event of data.events) {
      byDay.get(event.start.slice(0, 10))?.push(event);
    }
    return grid.days.map((date) => {
      const events = byDay.get(date) ?? [];
      return {
        date,
        number: Number(date.slice(8)),
        inMonth: monthOf(date) === data.month,
        isToday: date === today,
        manual: events.filter((e) => e.source === null).sort(byStart),
        routine: events.filter((e) => e.source !== null).length,
      };
    });
  });

  constructor() {
    this.requests
      .pipe(
        // A newer request cancels the older one: only the last answer reaches the state.
        switchMap((month) => this.load(month)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => this.apply(result));
    inject(DataChanges)
      .events$.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.reload());
  }

  /** Shows `month`. */
  showMonth(month: IsoMonth): void {
    this.monthState.set(month);
    this.statusState.set('loading');
    this.requests.next(month);
  }

  /** Asks the server again for the month on screen (after a change, or «Повторить»). */
  reload(): void {
    const month = this.month();
    if (month !== null) {
      this.showMonth(month);
    }
  }

  /** An event of the loaded month, with its `version`, for the editor. */
  eventById(id: string): EventResponse | undefined {
    return this.dataState()?.events.find((e) => e.id === id);
  }

  private load(month: IsoMonth) {
    return defer(() => {
      const workspace = this.session.workspace();
      if (workspace === null) {
        // No workspace is the same as «not found»: it takes the common route below.
        return throwError(() => new ApiError('WORKSPACE_NOT_FOUND', { status: 404 }));
      }
      const { days } = monthGrid(month);
      return this.api.range(workspace.id, days[0], days[days.length - 1]);
    }).pipe(
      map((events) => ({ month, events }) as const),
      catchError((error: unknown) =>
        of({ month, error: isApiError(error) ? error : new ApiError('UNKNOWN') } as const),
      ),
    );
  }

  private apply(
    result: { month: IsoMonth; events: EventResponse[] } | { month: IsoMonth; error: ApiError },
  ) {
    if ('events' in result) {
      this.dataState.set({ month: result.month, events: result.events });
      this.errorState.set(null);
      this.statusState.set('ready');
      return;
    }
    // The old month stays only if it is the one that was asked for: a grid showing another
    // month under an error would lie.
    if (this.dataState()?.month !== result.month) {
      this.dataState.set(null);
    }
    this.errorState.set(result.error);
    this.statusState.set('error');
    if (result.error.code === 'WORKSPACE_NOT_FOUND') {
      this.workspaceRefresh.workspaceNotFound();
    }
  }
}

function byStart(a: EventResponse, b: EventResponse): number {
  return a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : 1;
}
