// «Запланировано» (CAL-02, FD §0.3): the nearest manual events, built from E1 over the next
// 93 days — not from E2, which also gives template events by 20 and may hold only «Работа»
// and «Сон» on its first page. Loads itself: when it is created, when «today» moves on and
// after every change of events (FD-27, FD-28).
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
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
import { addDays, parseLocalDateTime } from '@shared/time';
import { EVENT_RANGE_MAX_DAYS } from '@shared/domain';

/** How many events the block shows (prototype). */
export const UPCOMING_LIMIT = 8;

export type UpcomingStatus = 'loading' | 'ready' | 'error';

@Injectable()
export class UpcomingStore {
  private readonly api = inject(EventsApi);
  private readonly session = inject(SessionStore);
  private readonly workspaceRefresh = inject(WorkspaceRefresh);
  private readonly zoneClock = inject(ZoneClock);
  private readonly requests = new Subject<IsoDate>();

  private readonly statusState = signal<UpcomingStatus>('loading');
  private readonly eventsState = signal<readonly EventResponse[] | null>(null);
  private readonly errorState = signal<ApiError | null>(null);

  readonly status = this.statusState.asReadonly();
  readonly error = this.errorState.asReadonly();

  private readonly zone = computed(() => this.session.timeZone() ?? 'UTC');
  /** «Today» in the workspace zone; changes only at midnight there. */
  readonly today = computed(() => this.zoneClock.todayIn(this.zone(), this.zoneClock.minuteTick()));
  private readonly now = computed(() =>
    this.zoneClock.nowIn(this.zone(), this.zoneClock.minuteTick()),
  );

  /**
   * Manual events that have not ended yet (a running one is still «ahead»), by start, the
   * first eight. Empty until the first answer.
   */
  readonly events = computed<readonly EventResponse[]>(() => {
    const now = this.now();
    return (this.eventsState() ?? [])
      .filter((event) => event.source === null && parseLocalDateTime(event.end) > now)
      .slice(0, UPCOMING_LIMIT);
  });

  constructor() {
    this.requests
      .pipe(
        // A newer request cancels the older one: only the last answer reaches the state.
        switchMap((today) => this.load(today)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => this.apply(result));
    // The first load, and again when midnight passes in the workspace zone.
    effect(() => this.requests.next(this.today()));
    inject(DataChanges)
      .events$.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.reload());
  }

  /** Asks the server again (after a change, or «Повторить»). */
  reload(): void {
    this.statusState.update((status) => (status === 'ready' ? status : 'loading'));
    this.requests.next(this.today());
  }

  private load(today: IsoDate) {
    return defer(() => {
      const workspace = this.session.workspace();
      if (workspace === null) {
        // No workspace is the same as «not found»: it takes the common route below.
        return throwError(() => new ApiError('WORKSPACE_NOT_FOUND', { status: 404 }));
      }
      return this.api.range(workspace.id, today, addDays(today, EVENT_RANGE_MAX_DAYS - 1));
    }).pipe(
      map((events) => ({ events }) as const),
      catchError((error: unknown) =>
        of({ error: isApiError(error) ? error : new ApiError('UNKNOWN') } as const),
      ),
    );
  }

  private apply(result: { events: EventResponse[] } | { error: ApiError }) {
    if ('events' in result) {
      this.eventsState.set(result.events);
      this.errorState.set(null);
      this.statusState.set('ready');
      return;
    }
    this.errorState.set(result.error);
    this.statusState.set('error');
    if (result.error.code === 'WORKSPACE_NOT_FOUND') {
      this.workspaceRefresh.workspaceNotFound();
    }
  }
}
