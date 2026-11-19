// The week on screen (FD-25…28, decisions §4): loads S1, keeps the previous week while the
// next one loads, and turns the answer into the two panels of the board. Knows neither the
// DOM nor the router: the page tells it which week to show.
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, defer, map, of, Subject, switchMap, throwError } from 'rxjs';
import { WeekApi } from '@core/api/week-api';
import type { IsoDate } from '@core/api/models/common.models';
import type { WeekResponse } from '@core/api/models/week.models';
import type { Seat } from '@core/api/models/workspace.models';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { ApiError, isApiError } from '@core/error/api-error';
import { ZoneClock } from '@core/time/zone-clock';
import { weekLabel } from '@shared/time';
import type { BoardPanel } from '@shared/timeline/board/board.models';
import { buildPanelLayout } from '@shared/timeline/engine/panel-layout';
import { toTimelineEvents } from '@shared/timeline/engine/to-timeline-events';

/** `idle` — no week was asked for yet. `loading` may come with the previous week's `data`. */
export type WeekStatus = 'idle' | 'loading' | 'ready' | 'error';

/** One side of the board: a member's panel, or the place of the one who has not joined. */
export type WeekPanel =
  | { readonly kind: 'member'; readonly panel: BoardPanel }
  | { readonly kind: 'placeholder'; readonly seat: Seat };

const SEATS: readonly Seat[] = [1, 2];

@Injectable()
export class WeekStore {
  private readonly api = inject(WeekApi);
  private readonly session = inject(SessionStore);
  private readonly workspaceRefresh = inject(WorkspaceRefresh);
  private readonly zoneClock = inject(ZoneClock);
  private readonly requests = new Subject<IsoDate>();

  private readonly weekStartState = signal<IsoDate | null>(null);
  private readonly statusState = signal<WeekStatus>('idle');
  private readonly dataState = signal<WeekResponse | null>(null);
  private readonly errorState = signal<ApiError | null>(null);

  /** The week that was asked for (it may be ahead of `data` while loading). */
  readonly weekStart = this.weekStartState.asReadonly();
  readonly status = this.statusState.asReadonly();
  /** The last week that arrived; kept while the next one loads (decisions §4). */
  readonly data = this.dataState.asReadonly();
  readonly error = this.errorState.asReadonly();

  /** «9 – 15 ноября 2026» of the requested week; empty before the first request. */
  readonly periodLabel = computed(() => {
    const weekStart = this.weekStart();
    return weekStart === null ? '' : weekLabel(weekStart);
  });
  readonly appliedTemplates = computed(() => this.data()?.appliedTemplates ?? []);
  /** The week has loaded and there is not a single event in it. */
  readonly isEmpty = computed(() => this.data()?.events.length === 0 && this.status() === 'ready');

  /** IANA zone of the loaded week; `null` until it arrives. */
  readonly timeZone = computed(() => this.data()?.timeZone ?? null);
  /** «Today» in the zone of the loaded week; changes only at midnight there. */
  readonly today = computed(() => {
    const zone = this.timeZone();
    return zone === null ? null : this.zoneClock.todayIn(zone, this.zoneClock.minuteTick());
  });

  /**
   * Seat 1 on the left, seat 2 on the right, for the loaded week; a seat nobody takes is
   * a placeholder (the invite card). Empty until the first week arrives.
   */
  readonly panels = computed<readonly WeekPanel[]>(() => {
    const data = this.data();
    if (data === null) {
      return [];
    }
    const events = toTimelineEvents(data.events);
    const range = { firstDay: data.weekStart, dayCount: 7 } as const;
    const today = this.today();
    return SEATS.map((seat): WeekPanel => {
      const member = data.members.find((m) => m.seat === seat);
      return member === undefined
        ? { kind: 'placeholder', seat }
        : {
            kind: 'member',
            panel: {
              name: member.displayName,
              seat,
              layout: buildPanelLayout(events, range, member.userId, { today }),
            },
          };
    });
  });

  constructor() {
    this.requests
      .pipe(
        // A newer request cancels the older one: only the last answer reaches the state.
        switchMap((date) => this.load(date)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => this.apply(result));
    inject(DataChanges)
      .events$.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.reload());
  }

  /** Shows the week that starts on `weekStart` (a Monday). */
  setWeek(weekStart: IsoDate): void {
    this.weekStartState.set(weekStart);
    this.statusState.set('loading');
    this.requests.next(weekStart);
  }

  /** Asks the server again for the current week (after a change, or «Повторить»). */
  reload(): void {
    const weekStart = this.weekStart();
    if (weekStart !== null) {
      this.setWeek(weekStart);
    }
  }

  private load(date: IsoDate) {
    return defer(() => {
      const workspace = this.session.workspace();
      // No workspace is the same as «not found»: it takes the common route below.
      return workspace === null
        ? throwError(() => new ApiError('WORKSPACE_NOT_FOUND', { status: 404 }))
        : this.api.get(workspace.id, date);
    }).pipe(
      map((data) => ({ date, data }) as const),
      catchError((error: unknown) =>
        of({ date, error: isApiError(error) ? error : new ApiError('UNKNOWN') } as const),
      ),
    );
  }

  private apply(
    result: { date: IsoDate; data: WeekResponse } | { date: IsoDate; error: ApiError },
  ) {
    if ('data' in result) {
      this.dataState.set(result.data);
      this.errorState.set(null);
      this.statusState.set('ready');
      return;
    }
    // The old week is kept only if it is the one that was asked for: a board showing
    // another week under an error would lie.
    if (this.dataState()?.weekStart !== result.date) {
      this.dataState.set(null);
    }
    this.errorState.set(result.error);
    this.statusState.set('error');
    if (result.error.code === 'WORKSPACE_NOT_FOUND') {
      this.workspaceRefresh.workspaceNotFound();
    }
  }
}
