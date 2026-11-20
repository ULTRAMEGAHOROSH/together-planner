import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { EventsApi } from '@core/api/events-api';
import type { Uuid } from '@core/api/models/common.models';
import type { EventRequest, EventResponse } from '@core/api/models/event.models';
import { SessionStore } from '@core/auth/session-store';
import type { ApiError } from '@core/error/api-error';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { DataChanges } from '@core/changes/data-changes';
import { ToastService } from '@core/notify/toast-service';
import { ZoneClock } from '@core/time/zone-clock';
import { ViewContext } from '@core/view/view-context';
import { weekUrl } from '@features/schedule';
import { formatDate, parseLocalDateTime, weekStartOf } from '@shared/time';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { EventConflictDialog } from './event-conflict-dialog/event-conflict-dialog';
import { type EventDialogControl, openEventDialog } from './event-dialog/event-dialog';
import { type CreatePrefill, fromEventResponse, prefillCreate } from './event-form';

/** The notice when the server moved a time that does not exist (spring-forward gap, spec §3). */
export const TIME_ADJUSTED_NOTE = 'Время скорректировано: в этот день часы переводятся';

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
    let sent: EventRequest | null = null;
    openEventDialog(this.dialogs, {
      mode: 'create',
      value: prefillCreate(prefill),
      members: this.session.members(),
      templateName: null,
      save: (request) => {
        sent = request;
        return this.api.create(workspace.id, request);
      },
    }).subscribe((result) => {
      // A cancel gives `undefined`; the dialog gives a response only for a save.
      if (typeof result === 'object') {
        this.saved(result, 'Событие создано', sent);
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
    // The version moves on when the user loads a newer one after a conflict.
    let current = event;
    let sent: EventRequest | null = null;
    openEventDialog(this.dialogs, {
      mode: 'edit',
      value: fromEventResponse(event, this.session.members()),
      members: this.session.members(),
      templateName: event.source?.templateName ?? null,
      save: (request) => {
        sent = request;
        return this.api.update(workspace.id, event.id, { ...request, version: current.version });
      },
      remove: () => this.api.delete(workspace.id, event.id, current.version),
      onFailure: (error, dialog) =>
        this.recover(error, dialog, workspace.id, event.id, (fresh) => (current = fresh)),
    }).subscribe((result) => {
      if (result === 'deleted') {
        this.changes.eventsChanged();
        this.toast.show('Событие удалено');
      } else if (typeof result === 'object') {
        this.saved(result, 'Изменения сохранены', sent);
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

  /**
   * A failed save or delete of an open edit: someone else changed the event (409) → ask, and
   * on «load the current one» (E4) refill the dialog, which then saves with the new
   * version; the event is gone (404) → say so and close. Anything else is not ours: `false`.
   * Errors here come through `errorInterceptor`, so they are `ApiError`.
   */
  private recover(
    error: unknown,
    dialog: EventDialogControl,
    workspaceId: Uuid,
    eventId: Uuid,
    take: (fresh: EventResponse) => void,
  ): boolean {
    const { code } = error as ApiError;
    if (code === 'EVENT_NOT_FOUND') {
      this.changes.eventsChanged();
      this.toast.show(ERROR_MESSAGES.EVENT_NOT_FOUND);
      dialog.close();
      return true;
    }
    if (code !== 'VERSION_CONFLICT') {
      return false;
    }
    this.dialogs.open<true>(EventConflictDialog, undefined, { size: 'sm' }).subscribe((load) => {
      if (load) {
        this.api.get(workspaceId, eventId).subscribe({
          next: (fresh) => {
            take(fresh);
            dialog.reload(fresh);
          },
          error: (failure: unknown) => {
            if (!this.recover(failure, dialog, workspaceId, eventId, take)) {
              this.toast.error(failure);
            }
          },
        });
      }
    });
    return true;
  }

  /**
   * `sent` is what E3/E5 got: if the answer has another start or end (to the minute), the
   * server moved a time that does not exist on that day (EVT-08) and the toast says so.
   */
  private saved(event: EventResponse, text: string, sent: EventRequest | null): void {
    this.changes.eventsChanged();
    if (sent !== null && wasAdjusted(sent, event)) {
      text = `${text}. ${TIME_ADJUSTED_NOTE}`;
    }
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

/** Compares to the minute: the request has no seconds, the answer may have them. */
function wasAdjusted(sent: EventRequest, answer: EventResponse): boolean {
  const minute = (value: string) => value.slice(0, 16);
  return minute(sent.start) !== minute(answer.start) || minute(sent.end) !== minute(answer.end);
}
