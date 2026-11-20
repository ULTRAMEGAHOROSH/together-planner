// The event form without a component (FD-81): the FormGroup, its validators and the
// mappers to and from the API. Limits come from shared/domain/event-constraints.ts (FD-82).
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  type ValidationErrors,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { merge, type Subscription } from 'rxjs';
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import type { EventCategory, EventColor } from '@core/api/models/enums';
import type { EventRequest, EventResponse } from '@core/api/models/event.models';
import type { MemberResponse, Seat } from '@core/api/models/workspace.models';
import { ERROR_MESSAGES, FIELD_ERROR_MESSAGES } from '@core/error/error-messages';
import {
  EVENT_DESCRIPTION_MAX,
  EVENT_MAX_DURATION_MINUTES,
  EVENT_TITLE_MAX,
  EVENT_YEAR_MAX,
  EVENT_YEAR_MIN,
} from '@shared/domain';
import { controlErrorMessage, type ServerErrorMap } from '@shared/forms/server-errors';
import { notBlank } from '@shared/forms/validators';
import {
  formatDate,
  formatLocalDateTime,
  formatTime,
  fromLocalMinutes,
  type LocalMinutes,
  minutesOfDay,
  parseDate,
  parseLocalDateTime,
  parseTime,
} from '@shared/time';

/** The plain values of the form: what a native `date` and `time` input holds. */
export interface EventFormValue {
  title: string;
  description: string;
  /** `YYYY-MM-DD`, empty while the field is empty. */
  startDate: string;
  /** `HH:mm`. */
  startTime: string;
  endDate: string;
  endTime: string;
  participants: { seat1: boolean; seat2: boolean };
  category: EventCategory;
  /** `null` — «как у категории». */
  color: EventColor | null;
}

/** How long a new event lasts when it is started from the grid or the header (prototype). */
export const NEW_EVENT_MINUTES = 60;

const EMPTY: EventFormValue = {
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  participants: { seat1: false, seat2: false },
  category: 'OTHER',
  color: null,
};

/** A field as the user sees it: start and end are each a date and a time together. */
export type EventField = 'title' | 'description' | 'start' | 'end' | 'participants';

/**
 * What the form as a whole says, by field (`form.errors`): the checks that need several
 * controls. A field with no entry is fine. The texts are in {@link eventFieldError}.
 */
export interface EventFormErrors {
  start?: 'yearRange';
  end?: 'notAfterStart' | 'tooLong';
  participants?: 'none';
}

/** Title ≤ 100 after trim, as the backend counts it; same error shape as `maxLength`. */
const titleMax: ValidatorFn = (control) => {
  const length = String(control.value).trim().length;
  return length > EVENT_TITLE_MAX
    ? { maxlength: { requiredLength: EVENT_TITLE_MAX, actualLength: length } }
    : null;
};

/** An empty value is `required`'s business; anything else must parse. */
function parses(parse: (value: string) => number, key: string): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = String(control.value);
    if (value === '') return null;
    try {
      parse(value);
      return null;
    } catch {
      return { [key]: true };
    }
  };
}

/** The local minutes of a date and a time, `null` while either is empty or not valid. */
function minutesOf(date: string, time: string): LocalMinutes | null {
  try {
    return parseLocalDateTime(`${date}T${time}`);
  } catch {
    return null;
  }
}

function crossChecks(value: EventFormValue): EventFormErrors | null {
  const errors: EventFormErrors = {};
  if (!value.participants.seat1 && !value.participants.seat2) {
    errors.participants = 'none';
  }
  const start = minutesOf(value.startDate, value.startTime);
  const end = minutesOf(value.endDate, value.endTime);
  if (start !== null) {
    const { year } = fromLocalMinutes(start);
    if (year < EVENT_YEAR_MIN || year > EVENT_YEAR_MAX) {
      errors.start = 'yearRange';
    }
    if (end !== null && end <= start) {
      errors.end = 'notAfterStart';
    } else if (end !== null && end - start > EVENT_MAX_DURATION_MINUTES) {
      errors.end = 'tooLong';
    }
  }
  return Object.keys(errors).length === 0 ? null : errors;
}

/** The event form (FD-80: typed, non-nullable); `value` fills it in, the rest is empty. */
export function createEventForm(value: Partial<EventFormValue> = {}) {
  const initial = { ...EMPTY, ...value };
  const text = (initialValue: string, ...validators: ValidatorFn[]) =>
    new FormControl(initialValue, { nonNullable: true, validators });
  const form = new FormGroup(
    {
      title: text(initial.title, notBlank, titleMax),
      description: text(initial.description, Validators.maxLength(EVENT_DESCRIPTION_MAX)),
      startDate: text(initial.startDate, Validators.required, parses(parseDate, 'date')),
      startTime: text(initial.startTime, Validators.required, parses(parseTime, 'time')),
      endDate: text(initial.endDate, Validators.required, parses(parseDate, 'date')),
      endTime: text(initial.endTime, Validators.required, parses(parseTime, 'time')),
      participants: new FormGroup({
        seat1: new FormControl(initial.participants.seat1, { nonNullable: true }),
        seat2: new FormControl(initial.participants.seat2, { nonNullable: true }),
      }),
      category: new FormControl<EventCategory>(initial.category, { nonNullable: true }),
      color: new FormControl<EventColor | null>(initial.color),
    },
    { validators: (group) => crossChecks(group.value as EventFormValue) },
  );
  // A date and a time are one field: editing one recomputes the other, which drops a server
  // error set on it (it would otherwise stay under the field until the other one is edited).
  const { startDate, startTime, endDate, endTime } = form.controls;
  for (const [first, second] of [
    [startDate, startTime],
    [endDate, endTime],
  ]) {
    first.valueChanges.subscribe(() => second.updateValueAndValidity({ emitEvent: false }));
    second.valueChanges.subscribe(() => first.updateValueAndValidity({ emitEvent: false }));
  }
  return form;
}

export type EventForm = ReturnType<typeof createEventForm>;

const CROSS_TEXT = {
  yearRange: ERROR_MESSAGES.EVENT_DATE_OUT_OF_RANGE,
  notAfterStart: ERROR_MESSAGES.EVENT_END_NOT_AFTER_START,
  tooLong: ERROR_MESSAGES.EVENT_TOO_LONG,
  none: FIELD_ERROR_MESSAGES.noParticipants,
} as const;

/**
 * The text to show under a field, `null` if it is fine: the field's own controls first (a
 * server error sits there too), then the checks of the whole form. Whether to show it yet
 * (after the first attempt to save or after `blur`, FD-83) is the component's decision.
 */
export function eventFieldError(form: EventForm, field: EventField): string | null {
  const { controls } = form;
  const own: Record<EventField, AbstractControl[]> = {
    title: [controls.title],
    description: [controls.description],
    start: [controls.startDate, controls.startTime],
    end: [controls.endDate, controls.endTime],
    participants: [controls.participants],
  };
  for (const control of own[field]) {
    const message = controlErrorMessage(control);
    if (message !== null) return message;
  }
  const code = (form.errors as EventFormErrors | null)?.[field as keyof EventFormErrors];
  return code === undefined ? null : CROSS_TEXT[code];
}

/** Server codes of the form → the control that shows them (`applyServerErrors`). */
export const EVENT_SERVER_ERRORS: ServerErrorMap = {
  EVENT_END_NOT_AFTER_START: 'endDate',
  EVENT_TOO_LONG: 'endDate',
  EVENT_DATE_OUT_OF_RANGE: 'startDate',
  EVENT_PARTICIPANT_NOT_MEMBER: 'participants',
};

// --- Moving the end with the start ---------------------------------------------------

/** The start of the form in local minutes, `null` while it is empty or not valid. */
export function startOf(form: EventForm): LocalMinutes | null {
  const { startDate, startTime } = form.getRawValue();
  return minutesOf(startDate, startTime);
}

/**
 * After the start moved from `previousStart`, moves the end by the same distance: the
 * duration stays (prototype `setStart`). Nothing moves if the old start, the new start or
 * the end is not valid, or if the event had no duration (end not after the old start).
 */
export function shiftEndWithStart(form: EventForm, previousStart: LocalMinutes | null): void {
  const { endDate, endTime } = form.getRawValue();
  const start = startOf(form);
  const end = minutesOf(endDate, endTime);
  if (previousStart === null || start === null || end === null || end <= previousStart) return;
  const shifted = start + (end - previousStart);
  form.patchValue({ endDate: formatDate(shifted), endTime: timeOf(shifted) });
}

/**
 * Keeps the duration while the user edits the start: on every change of its date or time the
 * end moves with it. Returns the subscription, to end together with the form.
 */
export function keepDurationOnStartChange(form: EventForm): Subscription {
  let previous = startOf(form);
  const { startDate, startTime } = form.controls;
  return merge(startDate.valueChanges, startTime.valueChanges).subscribe(() => {
    shiftEndWithStart(form, previous);
    previous = startOf(form);
  });
}

// --- To and from the API --------------------------------------------------------------

function timeOf(minutes: LocalMinutes): string {
  return formatTime(minutesOfDay(minutes));
}

function idOfSeat(members: readonly MemberResponse[], seat: Seat): Uuid | undefined {
  return members.find((m) => m.seat === seat)?.userId;
}

/**
 * The request of the form (E3, E5): times as `YYYY-MM-DDTHH:mm` (FD-32), participants in
 * seat order, `color: null` for «как у категории», an empty description as `null`.
 * `version` only for an edit (E5), including 0. A chosen seat nobody has taken is left out.
 */
export function toEventRequest(
  form: EventForm,
  members: readonly MemberResponse[],
  version?: number,
): EventRequest {
  const value = form.getRawValue();
  const seats: Seat[] = [];
  if (value.participants.seat1) seats.push(1);
  if (value.participants.seat2) seats.push(2);
  const description = value.description.trim();
  const request: EventRequest = {
    title: value.title.trim(),
    description: description === '' ? null : description,
    start: formatLocalDateTime(parseLocalDateTime(`${value.startDate}T${value.startTime}`)),
    end: formatLocalDateTime(parseLocalDateTime(`${value.endDate}T${value.endTime}`)),
    participantIds: seats.flatMap((seat) => idOfSeat(members, seat) ?? []),
    category: value.category,
    color: value.color,
  };
  return version === undefined ? request : { ...request, version };
}

/** The values of the form for an event of the server (`…T08:00:00` → date and `08:00`). */
export function fromEventResponse(
  event: EventResponse,
  members: readonly MemberResponse[],
): EventFormValue {
  const taken = (seat: Seat) => {
    const id = idOfSeat(members, seat);
    return id !== undefined && event.participantIds.includes(id);
  };
  const start = parseLocalDateTime(event.start);
  const end = parseLocalDateTime(event.end);
  return {
    title: event.title,
    description: event.description ?? '',
    startDate: formatDate(start),
    startTime: timeOf(start),
    endDate: formatDate(end),
    endTime: timeOf(end),
    participants: { seat1: taken(1), seat2: taken(2) },
    category: event.category,
    color: event.color,
  };
}

/** Where the user wants to create an event: a day, a minute of it and whose panel it is. */
export interface CreatePrefill {
  date: IsoDate;
  /** Minutes since midnight. */
  minute: number;
  personSeat: Seat;
}

/** The values of a new event: an hour from `minute` of `date`, for the person of that seat. */
export function prefillCreate({ date, minute, personSeat }: CreatePrefill): EventFormValue {
  const start = parseDate(date) + minute;
  const end = start + NEW_EVENT_MINUTES;
  return {
    ...EMPTY,
    startDate: formatDate(start),
    startTime: timeOf(start),
    endDate: formatDate(end),
    endTime: timeOf(end),
    participants: { seat1: personSeat === 1, seat2: personSeat === 2 },
  };
}
