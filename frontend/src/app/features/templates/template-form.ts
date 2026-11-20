// The template form without a component (FD-81, TPL-03): the FormGroup with a FormArray of
// event rows, their validators and the mappers to and from the API. Limits come from
// shared/domain/event-constraints.ts (FD-82). An existing row keeps its `id` for good:
// the backend updates by id (spec §9.8), without it applied weeks would get duplicates.
import {
  type AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  type ValidationErrors,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { merge } from 'rxjs';
import type { Uuid } from '@core/api/models/common.models';
import type { DayOfWeek, EventCategory, EventColor } from '@core/api/models/enums';
import type {
  TemplateEventRequest,
  TemplateRequest,
  TemplateResponse,
} from '@core/api/models/template.models';
import type { MemberResponse, Seat } from '@core/api/models/workspace.models';
import { ERROR_MESSAGES, FIELD_ERROR_MESSAGES } from '@core/error/error-messages';
import {
  EVENT_DESCRIPTION_MAX,
  EVENT_TITLE_MAX,
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_DURATION_MAX,
  TEMPLATE_DURATION_MIN,
  TEMPLATE_END_DAY_OFFSET_MAX,
  TEMPLATE_EVENTS_MAX,
  TEMPLATE_NAME_MAX,
} from '@shared/domain';
import { controlErrorMessage, type ServerErrorMap } from '@shared/forms/server-errors';
import { notBlank } from '@shared/forms/validators';
import { DAY_MINUTES, formatTime, parseTime } from '@shared/time';

/** The plain values of one row: what a native `time` input and a number select hold. */
export interface TemplateEventFormValue {
  /** `null` — a new event; an existing one keeps the id the server gave it. */
  id: Uuid | null;
  title: string;
  description: string;
  dayOfWeek: DayOfWeek;
  /** `HH:mm`. */
  startTime: string;
  /** `HH:mm`: the time of day of the end, whatever day it falls on. */
  endTime: string;
  /** The end is this many days after the day of the start (`+N дней`). */
  endDayOffset: number;
  participants: { seat1: boolean; seat2: boolean };
  category: EventCategory;
  /** `null` — «как у категории». */
  color: EventColor | null;
}

export interface TemplateFormValue {
  name: string;
  description: string;
  events: TemplateEventFormValue[];
}

const EMPTY_EVENT: TemplateEventFormValue = {
  id: null,
  title: '',
  description: '',
  dayOfWeek: 'MONDAY',
  startTime: '',
  endTime: '',
  endDayOffset: 0,
  participants: { seat1: false, seat2: false },
  category: 'OTHER',
  color: null,
};

/** A field of a row as the user sees it: the end is a time and a «+N дней» together. */
export type TemplateEventField = 'title' | 'description' | 'start' | 'end' | 'participants';

/** What a row as a whole says, by field (`row.errors`). A field with no entry is fine. */
export interface TemplateEventErrors {
  end?: 'notAfterStart' | 'tooLong';
  participants?: 'none';
}

/** What the form as a whole says (`form.errors`). */
export interface TemplateFormErrors {
  events?: 'tooMany';
}

/** At most `max` characters after trim, as the backend counts; same shape as `maxLength`. */
function trimmedMax(max: number): ValidatorFn {
  return (control) => {
    const length = String(control.value).trim().length;
    return length > max ? { maxlength: { requiredLength: max, actualLength: length } } : null;
  };
}

/** An empty value is `required`'s business; anything else must be a time of day. */
const parsesTime: ValidatorFn = (control): ValidationErrors | null => {
  const value = String(control.value);
  if (value === '') return null;
  try {
    parseTime(value);
    return null;
  } catch {
    return { time: true };
  }
};

function minutesOfTime(time: string): number | null {
  try {
    return parseTime(time);
  } catch {
    return null;
  }
}

/**
 * Minutes from the start to the end: `offset × 1440 + end − start`. `null` while a time is
 * empty or not valid, or the offset is not a whole number. Not checked against the limits.
 */
export function durationOf(
  value: Pick<TemplateEventFormValue, 'startTime' | 'endTime' | 'endDayOffset'>,
): number | null {
  const start = minutesOfTime(value.startTime);
  const end = minutesOfTime(value.endTime);
  if (start === null || end === null || !Number.isInteger(value.endDayOffset)) return null;
  return value.endDayOffset * DAY_MINUTES + end - start;
}

function rowChecks(value: TemplateEventFormValue): TemplateEventErrors | null {
  const errors: TemplateEventErrors = {};
  if (!value.participants.seat1 && !value.participants.seat2) {
    errors.participants = 'none';
  }
  const duration = durationOf(value);
  if (duration !== null) {
    if (duration < TEMPLATE_DURATION_MIN) {
      errors.end = 'notAfterStart';
    } else if (duration > TEMPLATE_DURATION_MAX) {
      errors.end = 'tooLong';
    }
  }
  return Object.keys(errors).length === 0 ? null : errors;
}

/**
 * One row of the template. When the end is earlier than the start on the same day
 * (23:00 → 07:00) the end moves to «+1 день» by itself; an equal time stays an error
 * (0 minutes). It only reacts to edits, so a row filled from the server is never changed.
 */
export function createTemplateEventRow(value: Partial<TemplateEventFormValue> = {}) {
  const initial = { ...EMPTY_EVENT, ...value };
  const text = (initialValue: string, ...validators: ValidatorFn[]) =>
    new FormControl(initialValue, { nonNullable: true, validators });
  const row = new FormGroup(
    {
      id: new FormControl<Uuid | null>(initial.id),
      title: text(initial.title, notBlank, trimmedMax(EVENT_TITLE_MAX)),
      description: text(initial.description, Validators.maxLength(EVENT_DESCRIPTION_MAX)),
      dayOfWeek: new FormControl<DayOfWeek>(initial.dayOfWeek, { nonNullable: true }),
      startTime: text(initial.startTime, Validators.required, parsesTime),
      endTime: text(initial.endTime, Validators.required, parsesTime),
      endDayOffset: new FormControl(initial.endDayOffset, {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.min(0),
          Validators.max(TEMPLATE_END_DAY_OFFSET_MAX),
        ],
      }),
      participants: new FormGroup({
        seat1: new FormControl(initial.participants.seat1, { nonNullable: true }),
        seat2: new FormControl(initial.participants.seat2, { nonNullable: true }),
      }),
      category: new FormControl<EventCategory>(initial.category, { nonNullable: true }),
      color: new FormControl<EventColor | null>(initial.color),
    },
    { validators: (group) => rowChecks(group.getRawValue() as TemplateEventFormValue) },
  );
  const { startTime, endTime, endDayOffset } = row.controls;
  merge(startTime.valueChanges, endTime.valueChanges).subscribe(() => {
    const start = minutesOfTime(startTime.value);
    const end = minutesOfTime(endTime.value);
    if (start !== null && end !== null && end < start && endDayOffset.value === 0) {
      endDayOffset.setValue(1);
    }
  });
  return row;
}

export type TemplateEventRow = ReturnType<typeof createTemplateEventRow>;

/** The template form (FD-80: typed, non-nullable); `value` fills it in, the rest is empty. */
export function createTemplateForm(value: Partial<TemplateFormValue> = {}) {
  const name = value.name ?? '';
  const description = value.description ?? '';
  return new FormGroup(
    {
      name: new FormControl(name, {
        nonNullable: true,
        validators: [notBlank, trimmedMax(TEMPLATE_NAME_MAX)],
      }),
      description: new FormControl(description, {
        nonNullable: true,
        validators: [Validators.maxLength(TEMPLATE_DESCRIPTION_MAX)],
      }),
      events: new FormArray((value.events ?? []).map((event) => createTemplateEventRow(event))),
    },
    {
      validators: (group): TemplateFormErrors | null =>
        (group as TemplateForm).controls.events.length > TEMPLATE_EVENTS_MAX
          ? { events: 'tooMany' }
          : null,
    },
  );
}

export type TemplateForm = ReturnType<typeof createTemplateForm>;

/** Appends a new row (`id: null`) and returns it. */
export function addTemplateEvent(
  form: TemplateForm,
  value: Partial<TemplateEventFormValue> = {},
): TemplateEventRow {
  const row = createTemplateEventRow({ ...value, id: null });
  form.controls.events.push(row);
  return row;
}

/** Removes the row at `index`: its event is gone from the request, so the server deletes it. */
export function removeTemplateEvent(form: TemplateForm, index: number): void {
  form.controls.events.removeAt(index);
}

const EVENT_CROSS_TEXT = {
  notAfterStart: ERROR_MESSAGES.EVENT_END_NOT_AFTER_START,
  tooLong: FIELD_ERROR_MESSAGES.templateEventTooLong,
  none: FIELD_ERROR_MESSAGES.noParticipants,
} as const;

/**
 * The text to show under a field of a row, `null` if it is fine: the field's own controls
 * first (a server error sits there too), then the checks of the whole row. Whether to show
 * it yet (after the first attempt to save or after `blur`, FD-83) is the component's call.
 */
export function templateEventFieldError(
  row: TemplateEventRow,
  field: TemplateEventField,
): string | null {
  const { controls } = row;
  const own: Record<TemplateEventField, AbstractControl[]> = {
    title: [controls.title],
    description: [controls.description],
    start: [controls.startTime],
    end: [controls.endTime, controls.endDayOffset],
    participants: [controls.participants],
  };
  for (const control of own[field]) {
    const message = controlErrorMessage(control);
    if (message !== null) return message;
  }
  const code = (row.errors as TemplateEventErrors | null)?.[field as keyof TemplateEventErrors];
  return code === undefined ? null : EVENT_CROSS_TEXT[code];
}

/** The error of the form as a whole: a server message, or too many events. */
export function templateFormError(form: TemplateForm): string | null {
  const errors = form.errors as (TemplateFormErrors & { server?: string }) | null;
  if (typeof errors?.server === 'string') return errors.server;
  return errors?.events === 'tooMany'
    ? FIELD_ERROR_MESSAGES.templateEventsMax(TEMPLATE_EVENTS_MAX)
    : null;
}

/**
 * Server codes of the template form → the control that shows them (`applyServerErrors`).
 * A name that is taken sits at the name; a vanished event or a non-member go to the form.
 */
export const TEMPLATE_SERVER_ERRORS: ServerErrorMap = {
  TEMPLATE_NAME_TAKEN: 'name',
  TEMPLATE_EVENT_NOT_FOUND: null,
  EVENT_PARTICIPANT_NOT_MEMBER: null,
};

// --- To and from the API --------------------------------------------------------------

function idOfSeat(members: readonly MemberResponse[], seat: Seat): Uuid | undefined {
  return members.find((m) => m.seat === seat)?.userId;
}

function toEventRequest(
  value: TemplateEventFormValue,
  members: readonly MemberResponse[],
): TemplateEventRequest {
  const seats: Seat[] = [];
  if (value.participants.seat1) seats.push(1);
  if (value.participants.seat2) seats.push(2);
  const description = value.description.trim();
  return {
    // As it is: an existing id is never dropped or replaced.
    id: value.id,
    title: value.title.trim(),
    description: description === '' ? null : description,
    dayOfWeek: value.dayOfWeek,
    startTime: formatTime(parseTime(value.startTime)),
    durationMinutes: durationOf(value) ?? 0,
    participantIds: seats.flatMap((seat) => idOfSeat(members, seat) ?? []),
    category: value.category,
    color: value.color,
  };
}

/**
 * The request of the form (T2, T4): rows in their order with their `id`, times as `HH:mm`,
 * the duration from the end, participants in seat order, `color: null` for «как у
 * категории», an empty description as `null`. `version` only for an edit (T4), including 0.
 */
export function toTemplateRequest(
  form: TemplateForm,
  members: readonly MemberResponse[],
  version?: number,
): TemplateRequest {
  const value = form.getRawValue() as TemplateFormValue;
  const description = value.description.trim();
  const request: TemplateRequest = {
    name: value.name.trim(),
    description: description === '' ? null : description,
    events: value.events.map((event) => toEventRequest(event, members)),
  };
  return version === undefined ? request : { ...request, version };
}

/**
 * The values of the form for a template of the server. The end is `start + duration`:
 * its time of day and the days it is after the day of the start.
 */
export function fromTemplateResponse(
  template: TemplateResponse,
  members: readonly MemberResponse[],
): TemplateFormValue {
  const taken = (seat: Seat, participantIds: readonly Uuid[]) => {
    const id = idOfSeat(members, seat);
    return id !== undefined && participantIds.includes(id);
  };
  return {
    name: template.name,
    description: template.description ?? '',
    events: template.events.map((event) => {
      const start = parseTime(event.startTime);
      const end = start + event.durationMinutes;
      return {
        id: event.id,
        title: event.title,
        description: event.description ?? '',
        dayOfWeek: event.dayOfWeek,
        startTime: formatTime(start),
        endTime: formatTime(end % DAY_MINUTES),
        endDayOffset: Math.floor(end / DAY_MINUTES),
        participants: {
          seat1: taken(1, event.participantIds),
          seat2: taken(2, event.participantIds),
        },
        category: event.category,
        color: event.color,
      };
    }),
  };
}
