import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { EventsApi } from '@core/api/events-api';
import type { EventResponse } from '@core/api/models/event.models';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { ToastService } from '@core/notify/toast-service';
import { ZoneClock } from '@core/time/zone-clock';
import { ViewContext } from '@core/view/view-context';
import { weekUrl } from '@features/schedule';
import { formatDate, parseLocalDateTime, weekStartOf } from '@shared/time';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { openEventDialog } from './event-dialog/event-dialog';
import { type CreatePrefill, fromEventResponse, prefillCreate } from './event-form';

/** Evening, when a new event is started from the header: the prototype's «19:00». */
const DEFAULT_START_MINUTE = 19 * 60;

/**
 * The public API of the events feature (FD-11): what the rest of the app calls to create
 * an event. Opens the dialog; the dialog stays open while the request runs and shows the
 * server's errors at the fields. After a save the week is re-read (`DataChanges`, FD-27)
 * and a toast says so, with «Показать» when the event is on a week that is not on screen.
 */
@Injectable({ providedIn: 'root' })
export class EventEditor {
  private readonly api = inject(EventsApi);
  private readonly dialogs = inject(DialogService);
  private readonly session = inject(SessionStore);
  private readonly changes = inject(DataChanges);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly view = inject(ViewContext);
  private readonly clock = inject(ZoneClock);

  /** A new event at a place of the schedule (a click on an empty slot of the board). */
  openCreate(prefill: CreatePrefill): void {
    const workspace = this.session.workspace();
    if (workspace === null) {
      return;
    }
    openEventDialog(this.dialogs, {
      mode: 'create',
      value: prefillCreate(prefill),
      members: this.session.members(),
      templateName: null,
      save: (request) => this.api.create(workspace.id, request),
    }).subscribe((result) => {
      // A cancel gives `undefined`; the dialog gives a response only for a save.
      if (typeof result === 'object') {
        this.saved(result, 'Событие создано');
      }
    });
  }

  /**
   * Edits an event of the week on screen (it has its `version`): E5 with that version. The
   * template an event came from stays on it (E5 does not change `source`).
   */
  openEdit(event: EventResponse): void {
    const workspace = this.session.workspace();
    if (workspace === null) {
      return;
    }
    openEventDialog(this.dialogs, {
      mode: 'edit',
      value: fromEventResponse(event, this.session.members()),
      members: this.session.members(),
      templateName: event.source?.templateName ?? null,
      save: (request) =>
        this.api.update(workspace.id, event.id, { ...request, version: event.version }),
    }).subscribe((result) => {
      if (typeof result === 'object') {
        this.saved(result, 'Изменения сохранены');
      }
    });
  }

  /**
   * «+ Событие» of the header: the day on screen (or today), 19:00, the person who clicked.
   * The day comes from `ViewContext`; on a page without a schedule it is today.
   */
  openCreateDefault(): void {
    const zone = this.session.timeZone();
    const me = this.session.me();
    if (zone === null || me === null) {
      return;
    }
    this.openCreate({
      date: this.view.focusDate() ?? this.clock.todayIn(zone),
      minute: DEFAULT_START_MINUTE,
      personSeat: me.seat,
    });
  }

  private saved(event: EventResponse, text: string): void {
    this.changes.eventsChanged();
    const week = weekStartOf(formatDate(parseLocalDateTime(event.start)));
    const shown = this.view.focusDate();
    if (shown !== null && weekStartOf(shown) === week) {
      this.toast.show(text);
      return;
    }
    this.toast.show(text, {
      action: {
        label: 'Показать',
        run: () => void this.router.navigateByUrl(weekUrl({ weekStart: week, day: null })),
      },
    });
  }
}
