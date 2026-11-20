// The journal of applications (TPL-10, T8): the first page, «Показать ещё» for the next ones,
// and a fresh first page after any change of templates (an application adds a line).
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiError, isApiError } from '@core/error/api-error';
import type { TemplateApplicationResponse } from '@core/api/models/template.models';
import { TemplateApplicationsApi } from '@core/api/template-applications-api';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import type { Subscription } from 'rxjs';

export const HISTORY_PAGE_SIZE = 20;

/** `idle` — not asked yet. `loading` — the first page (the old lines stay while it reloads). */
export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

@Injectable()
export class HistoryStore {
  private readonly api = inject(TemplateApplicationsApi);
  private readonly session = inject(SessionStore);
  private readonly changes = inject(DataChanges);

  private readonly statusState = signal<HistoryStatus>('idle');
  private readonly itemsState = signal<readonly TemplateApplicationResponse[]>([]);
  private readonly errorState = signal<ApiError | null>(null);
  private readonly hasNextState = signal(false);
  private readonly loadingMoreState = signal(false);
  private nextPage = 0;
  private request: Subscription | undefined;

  readonly status = this.statusState.asReadonly();
  readonly items = this.itemsState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** The server has older lines. */
  readonly hasNext = this.hasNextState.asReadonly();
  /** «Показать ещё» is running; a failure of it leaves the lines and says so in `error`. */
  readonly loadingMore = this.loadingMoreState.asReadonly();

  constructor() {
    this.changes.templates$
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.load());
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  /** The first page; replaces the lines when it arrives. */
  load(): void {
    this.fetch(0, false);
  }

  /** The next page, added below. */
  more(): void {
    if (this.hasNextState() && !this.loadingMoreState() && this.statusState() === 'ready') {
      this.fetch(this.nextPage, true);
    }
  }

  private fetch(page: number, append: boolean): void {
    const workspace = this.session.workspace();
    if (workspace === null) {
      return;
    }
    this.request?.unsubscribe();
    if (append) {
      this.loadingMoreState.set(true);
    } else {
      this.loadingMoreState.set(false);
      this.statusState.set('loading');
    }
    this.request = this.api.history(workspace.id, page, HISTORY_PAGE_SIZE).subscribe({
      next: (response) => {
        this.itemsState.update((items) =>
          append ? [...items, ...response.items] : response.items,
        );
        this.nextPage = response.page + 1;
        this.hasNextState.set(response.hasNext);
        this.errorState.set(null);
        this.loadingMoreState.set(false);
        this.statusState.set('ready');
      },
      error: (error: unknown) => {
        this.errorState.set(isApiError(error) ? error : new ApiError('UNKNOWN'));
        this.loadingMoreState.set(false);
        // A failed «ещё» keeps the lines that are there.
        this.statusState.set(append ? 'ready' : 'error');
      },
    });
  }
}
