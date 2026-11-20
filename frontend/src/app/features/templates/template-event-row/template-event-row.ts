import { Component, computed, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { DAYS_OF_WEEK, EVENT_CATEGORIES } from '@core/api/models/enums';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { CATEGORY_PALETTE } from '@shared/domain';
import { WEEKDAYS_SHORT } from '@shared/time';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Icon } from '@shared/ui/icon/icon';
import {
  type TemplateEventField,
  type TemplateEventRow,
  templateEventFieldError,
} from '../template-form';

const CATEGORIES = EVENT_CATEGORIES.map((key) => ({
  value: key,
  label: CATEGORY_PALETTE[key].label,
}));

/** «+0 дн.» … «+6 дн.»: the days the end is after the day of the start. */
const OFFSETS = [0, 1, 2, 3, 4, 5, 6];

/**
 * One event of a template (TPL-04): start and end time with «+N дн.», title, who takes
 * part, category, color and a description that unfolds. The form row comes from
 * `template-form.ts`; errors show after the field was touched or the first save attempt.
 */
@Component({
  selector: 'tp-template-event-row',
  imports: [Avatar, Icon, ReactiveFormsModule],
  templateUrl: './template-event-row.html',
  styleUrl: './template-event-row.scss',
})
export class TemplateEventRowComponent {
  readonly row = input.required<TemplateEventRow>();
  /** Workspace members, sorted by seat. */
  readonly members = input.required<readonly MemberResponse[]>();
  /** The first save attempt was made: every error may show. */
  readonly submitted = input(false);

  readonly duplicate = output();
  readonly remove = output();
  /** The day or the start time was settled: the page may sort the rows again. */
  readonly commit = output();

  protected readonly categories = CATEGORIES;
  protected readonly days = DAYS_OF_WEEK.map((value, i) => ({ value, label: WEEKDAYS_SHORT[i] }));
  protected readonly colors = EVENT_CATEGORIES.map((key) => ({
    value: key,
    label: CATEGORY_PALETTE[key].label,
  }));
  private readonly unfolded = signal(false);

  /** Reactive forms are not signals: every event of the row (value, status, touched). */
  private readonly changes = toSignal(toObservable(this.row).pipe(switchMap((row) => row.events)));

  /** «+7 дн.» exists only for a full week that came from the server. */
  protected readonly offsets = computed(() => {
    this.changes();
    return this.row().controls.endDayOffset.value === 7 ? [...OFFSETS, 7] : OFFSETS;
  });

  protected readonly errors = computed(() => {
    this.changes();
    const { controls } = this.row();
    const touched: Record<TemplateEventField, boolean> = {
      title: controls.title.touched,
      description: controls.description.touched,
      start: controls.startTime.touched,
      end: controls.endTime.touched || controls.endDayOffset.touched,
      participants: controls.participants.touched,
    };
    const show = (field: TemplateEventField) =>
      this.submitted() || touched[field] ? templateEventFieldError(this.row(), field) : null;
    return {
      title: show('title'),
      description: show('description'),
      start: show('start'),
      end: show('end'),
      participants: show('participants'),
    };
  });

  protected readonly people = computed(() =>
    this.members().map((member) => ({
      seat: member.seat,
      name: member.displayName,
      control: this.row().controls.participants.controls[member.seat === 1 ? 'seat1' : 'seat2'],
    })),
  );
  protected readonly bothChosen = computed(() => {
    this.changes();
    return this.people().every((person) => person.control.value);
  });
  /** Open by the user, or because the text has an error to show, or has text to read. */
  protected readonly descriptionOpen = computed(() => {
    this.changes();
    return (
      this.unfolded() ||
      this.row().controls.description.value !== '' ||
      this.errors().description !== null
    );
  });

  protected toggleDescription(): void {
    this.unfolded.update((open) => !open);
  }

  protected toggle(person: { control: { value: boolean; setValue(value: boolean): void } }): void {
    person.control.setValue(!person.control.value);
    this.row().controls.participants.markAsTouched();
  }

  protected chooseBoth(): void {
    this.row().controls.participants.setValue({ seat1: true, seat2: true });
    this.row().controls.participants.markAsTouched();
  }
}
