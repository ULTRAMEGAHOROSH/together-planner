import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { EventsApi } from '@core/api/events-api';
import type { EventResponse } from '@core/api/models/event.models';
import { SessionStore } from '@core/auth/session-store';
import { messageFor } from '@core/error/error-messages';
import { ZoneClock } from '@core/time/zone-clock';
import { Button } from '@shared/ui/button/button';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { UpcomingRows } from '../upcoming-rows/upcoming-rows';

/** E2 page size (CAL-03). */
export const UPCOMING_PAGE_SIZE = 20;

/**
 * «Все предстоящие» (CAL-03): every event that has not ended yet — manual ones and those that
 * came from templates — by E2, `UPCOMING_PAGE_SIZE` at a time, «Показать ещё» for the next
 * page. A click on a row closes the dialog with that event, and the caller opens it for edit.
 */
@Component({
  selector: 'tp-upcoming-all-dialog',
  imports: [Button, DialogShell, EmptyState, ErrorState, UpcomingRows],
  templateUrl: './upcoming-all-dialog.html',
  styleUrl: './upcoming-all-dialog.scss',
})
export class UpcomingAllDialog {
  protected readonly ref = inject<DialogRef<EventResponse>>(DialogRef);
  private readonly api = inject(EventsApi);
  private readonly session = inject(SessionStore);
  private readonly zoneClock = inject(ZoneClock);

  protected readonly members = this.session.members;
  protected readonly today = computed(() =>
    this.zoneClock.todayIn(this.session.timeZone() ?? 'UTC', this.zoneClock.minuteTick()),
  );

  protected readonly events = signal<readonly EventResponse[]>([]);
  /** A page is on its way (the first one, a next one, or a retry). */
  protected readonly loading = signal(true);
  protected readonly hasNext = signal(false);
  protected readonly errorText = signal<string | null>(null);
  private nextPage = 0;

  constructor() {
    this.loadMore();
  }

  /** The next page; after an error the same one again («Повторить»). */
  protected loadMore(): void {
    const workspace = this.session.workspace();
    if (workspace === null || (this.loading() && this.nextPage > 0)) {
      return;
    }
    this.loading.set(true);
    this.errorText.set(null);
    this.api.upcoming(workspace.id, this.nextPage, UPCOMING_PAGE_SIZE).subscribe({
      next: (page) => {
        this.events.update((all) => [...all, ...page.items]);
        this.hasNext.set(page.hasNext);
        this.nextPage = page.page + 1;
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorText.set(messageFor(error));
        this.loading.set(false);
      },
    });
  }

  protected pick(id: string): void {
    const event = this.events().find((e) => e.id === id);
    if (event) {
      this.ref.close(event);
    }
  }
}
