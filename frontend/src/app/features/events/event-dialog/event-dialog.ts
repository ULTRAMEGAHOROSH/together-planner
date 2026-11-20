import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FormControl, ReactiveFormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import { type EventCategory, EVENT_CATEGORIES } from '@core/api/models/enums';
import type { EventColor } from '@core/api/models/enums';
import type { EventRequest, EventResponse } from '@core/api/models/event.models';
import type { MemberResponse, Seat } from '@core/api/models/workspace.models';
import { ToastService } from '@core/notify/toast-service';
import { CATEGORY_PALETTE } from '@shared/domain';
import { applyServerErrors } from '@shared/forms/server-errors';
import { weekShort, weekStartOf } from '@shared/time';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Button } from '@shared/ui/button/button';
import { ChipGroup, type ChipOption } from '@shared/ui/chip-group/chip-group';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';
import { FormField, FormFieldControl } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import {
  createEventForm,
  EVENT_SERVER_ERRORS,
  eventFieldError,
  type EventField,
  type EventFormValue,
  keepDurationOnStartChange,
  toEventRequest,
} from '../event-form';

interface EventDialogBase {
  /** Starting values: `prefillCreate` for a new event, `fromEventResponse` for an edit. */
  value: EventFormValue;
  /** Workspace members, sorted by seat. */
  members: readonly MemberResponse[];
  /** Name of the template the event was created from, `null` for a manual one. */
  templateName: string | null;
  /**
   * Sends the request (E3 / E5). The dialog stays open while it runs; a server error
   * lands on its field, any other one in a toast. The response closes the dialog.
   */
  save: (request: EventRequest) => Observable<EventResponse>;
}

export type EventDialogData =
  | (EventDialogBase & { mode: 'create' })
  | (EventDialogBase & {
      mode: 'edit';
      /** Without it there is no «Удалить» (deleting comes with EVT-06). */
      remove?: () => Observable<unknown>;
    });

/** What the dialog closes with: the saved event, or `deleted`; `undefined` for a cancel. */
export type EventDialogResult = EventResponse | 'deleted';

/** A member as a button of «Участники»: its seat and the form flag of that seat. */
interface Person {
  seat: Seat;
  name: string;
  control: FormControl<boolean>;
}

const CATEGORY_OPTIONS: readonly ChipOption<EventCategory>[] = EVENT_CATEGORIES.map((key) => ({
  value: key,
  label: CATEGORY_PALETTE[key].label,
  dot: CATEGORY_PALETTE[key].dot,
  bg: CATEGORY_PALETTE[key].bg,
  fg: CATEGORY_PALETTE[key].fg,
}));

/**
 * The event dialog (prototype «ДИАЛОГ СОБЫТИЯ»): create and edit share it. All the logic is
 * in `event-form.ts`; this is the markup, when to show errors (after the first save attempt
 * or after `blur`, FD-83) and the save / delete requests, which the opener supplies.
 */
@Component({
  selector: 'tp-event-dialog',
  imports: [
    Avatar,
    Button,
    ChipGroup,
    DialogShell,
    FormField,
    FormFieldControl,
    Icon,
    ReactiveFormsModule,
  ],
  templateUrl: './event-dialog.html',
  styleUrl: './event-dialog.scss',
})
export class EventDialog {
  protected readonly data = inject<EventDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<EventDialogResult>>(DialogRef);
  private readonly toast = inject(ToastService);

  protected readonly form = createEventForm(this.data.value);
  protected readonly heading = this.data.mode === 'create' ? 'Новое событие' : 'Изменить событие';
  protected readonly categories = CATEGORY_OPTIONS;
  protected readonly swatches = EVENT_CATEGORIES.map((key) => ({
    value: key,
    label: CATEGORY_PALETTE[key].label,
    color: CATEGORY_PALETTE[key].dot,
  }));
  protected readonly people: readonly Person[] = this.data.members.map((member) => ({
    seat: member.seat,
    name: member.displayName,
    control: this.form.controls.participants.controls[member.seat === 1 ? 'seat1' : 'seat2'],
  }));
  protected readonly removable = this.data.mode === 'edit' ? (this.data.remove ?? null) : null;

  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly busy = computed(() => this.saving() || this.deleting());
  private readonly submitted = signal(false);

  /** Reactive forms are not signals: every event of the form (value, status, touched). */
  private readonly changes = toSignal(this.form.events);

  /** The text under each field; empty until the field may show it. */
  protected readonly errors = computed(() => {
    this.changes();
    const { controls } = this.form;
    const touched: Record<EventField, boolean> = {
      title: controls.title.touched,
      description: controls.description.touched,
      start: controls.startDate.touched || controls.startTime.touched,
      end: controls.endDate.touched || controls.endTime.touched,
      participants: controls.participants.touched,
    };
    const show = (field: EventField) =>
      this.submitted() || touched[field] ? eventFieldError(this.form, field) : null;
    return {
      title: show('title'),
      description: show('description'),
      start: show('start'),
      end: show('end'),
      participants: show('participants'),
    };
  });

  protected readonly category = computed(() => {
    this.changes();
    return this.form.controls.category.value;
  });
  protected readonly color = computed(() => {
    this.changes();
    return this.form.controls.color.value;
  });
  protected readonly bothChosen = computed(() => {
    this.changes();
    return this.people.every((person) => person.control.value);
  });

  /** An event over midnight is drawn in both days (a hint under the dates). */
  protected readonly crossesMidnight = computed(() => {
    this.changes();
    const { startDate, endDate } = this.form.getRawValue();
    return (
      endDate !== startDate &&
      eventFieldError(this.form, 'start') === null &&
      eventFieldError(this.form, 'end') === null
    );
  });

  /** «неделя 16–22 нояб.» of the start, `null` while the start is not a date. */
  protected readonly weekText = computed(() => {
    this.changes();
    const { startDate } = this.form.getRawValue();
    return eventFieldError(this.form, 'start') === null
      ? `неделя ${weekShort(weekStartOf(startDate))}`
      : null;
  });

  constructor() {
    const subscription = keepDurationOnStartChange(this.form);
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  protected setCategory(category: EventCategory): void {
    this.form.controls.category.setValue(category);
  }

  protected setColor(color: EventColor | null): void {
    this.form.controls.color.setValue(color);
  }

  protected toggle(person: Person): void {
    person.control.setValue(!person.control.value);
    this.form.controls.participants.markAsTouched();
  }

  /** «Оба». */
  protected chooseBoth(): void {
    this.form.controls.participants.setValue({ seat1: true, seat2: true });
    this.form.controls.participants.markAsTouched();
  }

  protected cancel(): void {
    this.ref.close();
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.busy() || this.form.invalid) return;
    this.saving.set(true);
    this.data.save(toEventRequest(this.form, this.data.members)).subscribe({
      next: (event) => this.ref.close(event),
      error: (error: unknown) => this.fail(error, this.saving),
    });
  }

  protected remove(run: () => Observable<unknown>): void {
    // The button is blocked while deleting (loading) and while saving (disabled).
    this.deleting.set(true);
    run().subscribe({
      next: () => this.ref.close('deleted'),
      error: (error: unknown) => this.fail(error, this.deleting),
    });
  }

  private fail(error: unknown, flag: { set(value: boolean): void }): void {
    flag.set(false);
    if (!applyServerErrors(this.form, error, EVENT_SERVER_ERRORS)) {
      this.toast.error(error);
    }
  }
}

/** Opens the event dialog; emits the saved event or `'deleted'`, `undefined` on cancel. */
export function openEventDialog(
  dialogs: DialogService,
  data: EventDialogData,
): Observable<EventDialogResult | undefined> {
  return dialogs.open<EventDialogResult, EventDialogData>(EventDialog, data);
}
