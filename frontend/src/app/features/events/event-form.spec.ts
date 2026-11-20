import { ApiError } from '@core/error/api-error';
import { ERROR_MESSAGES, FIELD_ERROR_MESSAGES } from '@core/error/error-messages';
import type { EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { applyServerErrors } from '@shared/forms/server-errors';
import { parseLocalDateTime } from '@shared/time';
import {
  createEventForm,
  EVENT_SERVER_ERRORS,
  eventFieldError,
  type EventFormValue,
  fromEventResponse,
  keepDurationOnStartChange,
  NEW_EVENT_MINUTES,
  prefillCreate,
  shiftEndWithStart,
  startOf,
  toEventRequest,
} from './event-form';

const MEMBERS: MemberResponse[] = [
  { userId: 'u-1', displayName: 'Аня', role: 'OWNER', seat: 1, joinedAt: '2026-11-01T10:00:00Z' },
  {
    userId: 'u-2',
    displayName: 'Борис',
    role: 'MEMBER',
    seat: 2,
    joinedAt: '2026-11-02T10:00:00Z',
  },
];

/** Friday 2026-11-20, 09:00–10:30, both people, a valid event. */
const VALID: Partial<EventFormValue> = {
  title: 'Ужин',
  startDate: '2026-11-20',
  startTime: '09:00',
  endDate: '2026-11-20',
  endTime: '10:30',
  participants: { seat1: true, seat2: false },
};

const formWith = (value: Partial<EventFormValue> = {}) => createEventForm({ ...VALID, ...value });

describe('createEventForm', () => {
  it('an empty form is not valid and has the defaults', () => {
    const form = createEventForm();

    expect(form.valid).toBe(false);
    expect(form.getRawValue()).toEqual({
      title: '',
      description: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      participants: { seat1: false, seat2: false },
      category: 'OTHER',
      color: null,
    });
  });

  it('a filled form is valid', () => {
    expect(formWith().valid).toBe(true);
    expect(eventFieldError(formWith(), 'title')).toBeNull();
    expect(eventFieldError(formWith(), 'description')).toBeNull();
    expect(eventFieldError(formWith(), 'start')).toBeNull();
    expect(eventFieldError(formWith(), 'end')).toBeNull();
    expect(eventFieldError(formWith(), 'participants')).toBeNull();
  });

  it('EF-01: a title of spaces is an error of the title', () => {
    const form = formWith({ title: '   ' });

    expect(form.valid).toBe(false);
    expect(eventFieldError(form, 'title')).toBe(FIELD_ERROR_MESSAGES.required);
  });

  it('a title is counted after trim: 100 fit, 101 do not', () => {
    expect(formWith({ title: ` ${'а'.repeat(100)} ` }).valid).toBe(true);

    const form = formWith({ title: 'а'.repeat(101) });
    expect(eventFieldError(form, 'title')).toBe(FIELD_ERROR_MESSAGES.maxlength(100));
  });

  it('a description is limited to 2000', () => {
    expect(formWith({ description: 'а'.repeat(2000) }).valid).toBe(true);

    const form = formWith({ description: 'а'.repeat(2001) });
    expect(eventFieldError(form, 'description')).toBe(FIELD_ERROR_MESSAGES.maxlength(2000));
  });

  it('an empty date or time is required, a broken one is invalid', () => {
    expect(eventFieldError(formWith({ startDate: '' }), 'start')).toBe(
      FIELD_ERROR_MESSAGES.required,
    );
    expect(eventFieldError(formWith({ endTime: '' }), 'end')).toBe(FIELD_ERROR_MESSAGES.required);
    expect(eventFieldError(formWith({ startDate: '2026-02-31' }), 'start')).toBe(
      FIELD_ERROR_MESSAGES.invalid,
    );
    expect(eventFieldError(formWith({ endTime: '25:00' }), 'end')).toBe(
      FIELD_ERROR_MESSAGES.invalid,
    );
    expect(startOf(formWith({ startDate: '2026-02-31' }))).toBeNull();
  });

  it('EF-02: end equal to start is an error of the end', () => {
    const form = formWith({ endTime: '09:00' });

    expect(form.valid).toBe(false);
    expect(eventFieldError(form, 'end')).toBe(ERROR_MESSAGES.EVENT_END_NOT_AFTER_START);
    expect(eventFieldError(form, 'start')).toBeNull();
  });

  it('an end before the start is an error of the end', () => {
    expect(eventFieldError(formWith({ endTime: '08:00' }), 'end')).toBe(
      ERROR_MESSAGES.EVENT_END_NOT_AFTER_START,
    );
  });

  it('EF-03: Friday 23:00 → Saturday 07:00 is valid', () => {
    const form = formWith({
      startTime: '23:00',
      endDate: '2026-11-21',
      endTime: '07:00',
    });

    expect(form.valid).toBe(true);
  });

  it('EF-04: exactly 31 days is valid, 31 days and a minute is an error of the end', () => {
    const exactly = formWith({ endDate: '2026-12-21', endTime: '09:00' });
    expect(exactly.valid).toBe(true);

    const over = formWith({ endDate: '2026-12-21', endTime: '09:01' });
    expect(eventFieldError(over, 'end')).toBe(ERROR_MESSAGES.EVENT_TOO_LONG);
  });

  it('EF-05: the year 1999 is an error of the start; 2000 and 2100 are fine', () => {
    const early = formWith({ startDate: '1999-12-31', endDate: '1999-12-31' });
    expect(eventFieldError(early, 'start')).toBe(ERROR_MESSAGES.EVENT_DATE_OUT_OF_RANGE);
    expect(eventFieldError(early, 'end')).toBeNull();

    const late = formWith({ startDate: '2101-01-01', endDate: '2101-01-01' });
    expect(eventFieldError(late, 'start')).toBe(ERROR_MESSAGES.EVENT_DATE_OUT_OF_RANGE);

    expect(formWith({ startDate: '2000-01-01', endDate: '2000-01-01' }).valid).toBe(true);
    expect(formWith({ startDate: '2100-12-31', endDate: '2100-12-31' }).valid).toBe(true);
  });

  it('EF-06: no participants is an error of the participants', () => {
    const form = formWith({ participants: { seat1: false, seat2: false } });

    expect(form.valid).toBe(false);
    expect(eventFieldError(form, 'participants')).toBe(FIELD_ERROR_MESSAGES.noParticipants);
  });

  it('either seat or both is enough', () => {
    expect(formWith({ participants: { seat1: false, seat2: true } }).valid).toBe(true);
    expect(formWith({ participants: { seat1: true, seat2: true } }).valid).toBe(true);
  });

  it('the checks of the whole form follow the values', () => {
    const form = formWith({ endTime: '09:00' });
    expect(form.valid).toBe(false);

    form.controls.endTime.setValue('10:00');

    expect(form.valid).toBe(true);
  });
});

describe('server errors', () => {
  const failure = (
    code:
      | 'EVENT_END_NOT_AFTER_START'
      | 'EVENT_TOO_LONG'
      | 'EVENT_DATE_OUT_OF_RANGE'
      | 'EVENT_PARTICIPANT_NOT_MEMBER',
  ) => new ApiError(code, { status: 400 });

  it('the code lands on the field the user sees', () => {
    const cases = [
      ['EVENT_END_NOT_AFTER_START', 'end'],
      ['EVENT_TOO_LONG', 'end'],
      ['EVENT_DATE_OUT_OF_RANGE', 'start'],
      ['EVENT_PARTICIPANT_NOT_MEMBER', 'participants'],
    ] as const;
    for (const [code, field] of cases) {
      const form = formWith();

      expect(applyServerErrors(form, failure(code), EVENT_SERVER_ERRORS)).toBe(true);

      expect(eventFieldError(form, field)).toBe(ERROR_MESSAGES[code]);
    }
  });

  it('the server error goes away on the next edit', () => {
    const form = formWith();
    applyServerErrors(form, failure('EVENT_END_NOT_AFTER_START'), EVENT_SERVER_ERRORS);

    form.controls.endTime.setValue('11:00');

    expect(eventFieldError(form, 'end')).toBeNull();
  });

  it('editing the time clears a server error that sits on the date, and the other way round', () => {
    const date = formWith();
    applyServerErrors(date, failure('EVENT_END_NOT_AFTER_START'), EVENT_SERVER_ERRORS);
    date.controls.endTime.setValue('11:00');
    expect(eventFieldError(date, 'end')).toBeNull();

    const time = formWith();
    applyServerErrors(time, failure('EVENT_DATE_OUT_OF_RANGE'), {
      EVENT_DATE_OUT_OF_RANGE: 'startTime',
    });
    time.controls.startDate.setValue('2026-11-21');
    expect(eventFieldError(time, 'start')).toBeNull();
  });

  it('a field of VALIDATION_FAILED shows «Проверьте это поле.»', () => {
    const form = formWith();

    applyServerErrors(
      form,
      new ApiError('VALIDATION_FAILED', { status: 400, fieldErrors: { title: ['x'] } }),
      EVENT_SERVER_ERRORS,
    );

    expect(eventFieldError(form, 'title')).toBe(FIELD_ERROR_MESSAGES.invalid);
  });
});

describe('moving the end with the start', () => {
  it('EF-07: the start 09:00 → 10:00 with the end 10:30 moves the end to 11:30', () => {
    const form = formWith();
    const before = startOf(form);
    form.controls.startTime.setValue('10:00', { emitEvent: false });

    shiftEndWithStart(form, before);

    expect(form.getRawValue().endDate).toBe('2026-11-20');
    expect(form.getRawValue().endTime).toBe('11:30');
  });

  it('the end crosses midnight with the start', () => {
    const form = formWith({ startTime: '22:00', endTime: '23:00' });
    const before = startOf(form);
    form.controls.startTime.setValue('23:30', { emitEvent: false });

    shiftEndWithStart(form, before);

    expect(form.getRawValue().endDate).toBe('2026-11-21');
    expect(form.getRawValue().endTime).toBe('00:30');
  });

  it('moving the date of the start moves the date of the end', () => {
    const form = formWith();
    const before = startOf(form);
    form.controls.startDate.setValue('2026-11-22', { emitEvent: false });

    shiftEndWithStart(form, before);

    expect(form.getRawValue().endDate).toBe('2026-11-22');
    expect(form.getRawValue().endTime).toBe('10:30');
  });

  it('nothing moves when the old start, the new start or the end is not valid', () => {
    const noOldStart = formWith();
    noOldStart.controls.startTime.setValue('10:00', { emitEvent: false });
    shiftEndWithStart(noOldStart, null);
    expect(noOldStart.getRawValue().endTime).toBe('10:30');

    const noNewStart = formWith();
    const before = startOf(noNewStart);
    noNewStart.controls.startTime.setValue('', { emitEvent: false });
    shiftEndWithStart(noNewStart, before);
    expect(noNewStart.getRawValue().endTime).toBe('10:30');

    const noEnd = formWith({ endTime: '' });
    const old = startOf(noEnd);
    noEnd.controls.startTime.setValue('10:00', { emitEvent: false });
    shiftEndWithStart(noEnd, old);
    expect(noEnd.getRawValue().endTime).toBe('');
  });

  it('an event without a duration keeps its end', () => {
    const form = formWith({ endTime: '09:00' });
    const before = startOf(form);
    form.controls.startTime.setValue('10:00', { emitEvent: false });

    shiftEndWithStart(form, before);

    expect(form.getRawValue().endTime).toBe('09:00');
  });

  it('keepDurationOnStartChange follows every edit of the start and stops on unsubscribe', () => {
    const form = formWith();
    const subscription = keepDurationOnStartChange(form);

    form.controls.startTime.setValue('10:00');
    expect(form.getRawValue().endTime).toBe('11:30');

    form.controls.startTime.setValue('10:30');
    expect(form.getRawValue().endTime).toBe('12:00');

    form.controls.startDate.setValue('2026-11-21');
    expect(form.getRawValue().endDate).toBe('2026-11-21');

    subscription.unsubscribe();
    form.controls.startTime.setValue('11:00');
    expect(form.getRawValue().endTime).toBe('12:00');
  });

  it('editing the end alone does not move the start', () => {
    const form = formWith();
    keepDurationOnStartChange(form);

    form.controls.endTime.setValue('12:00');

    expect(form.getRawValue().startTime).toBe('09:00');
  });
});

describe('toEventRequest', () => {
  it('EF-08: start, participants by seat, color null, no version on create', () => {
    const form = formWith({
      title: '  Завтрак  ',
      description: '   ',
      startTime: '08:00',
      endTime: '09:00',
      participants: { seat1: true, seat2: true },
      category: 'FOOD',
    });

    const request = toEventRequest(form, MEMBERS);

    expect(request).toEqual({
      title: 'Завтрак',
      description: null,
      start: '2026-11-20T08:00',
      end: '2026-11-20T09:00',
      participantIds: ['u-1', 'u-2'],
      category: 'FOOD',
      color: null,
    });
    expect('version' in request).toBe(false);
  });

  it('only the chosen seats go, in seat order', () => {
    const second = toEventRequest(
      formWith({ participants: { seat1: false, seat2: true } }),
      MEMBERS,
    );
    expect(second.participantIds).toEqual(['u-2']);
  });

  it('a seat nobody has taken is left out', () => {
    const request = toEventRequest(
      formWith({ participants: { seat1: true, seat2: true } }),
      MEMBERS.slice(0, 1),
    );

    expect(request.participantIds).toEqual(['u-1']);
  });

  it('a chosen color and a trimmed description go as they are', () => {
    const request = toEventRequest(
      formWith({ description: ' заметка ', color: 'TRIP', startTime: '09:00:00' }),
      MEMBERS,
    );

    expect(request.description).toBe('заметка');
    expect(request.color).toBe('TRIP');
    expect(request.start).toBe('2026-11-20T09:00');
  });

  it('version goes on edit, including 0', () => {
    expect(toEventRequest(formWith(), MEMBERS, 3).version).toBe(3);
    expect(toEventRequest(formWith(), MEMBERS, 0).version).toBe(0);
  });
});

describe('fromEventResponse', () => {
  const EVENT: EventResponse = {
    id: 'e-1',
    title: 'Ужин',
    description: null,
    start: '2026-11-20T08:00:00',
    end: '2026-11-21T00:30:00',
    participantIds: ['u-2'],
    category: 'FOOD',
    color: 'TRIP',
    source: null,
    createdBy: 'u-1',
    updatedBy: 'u-1',
    createdAt: '2026-11-20T07:00:00Z',
    updatedAt: '2026-11-20T07:00:00Z',
    version: 4,
  };

  it('EF-09: …T08:00:00 gives 2026-11-20 and 08:00', () => {
    const value = fromEventResponse(EVENT, MEMBERS);

    expect(value).toEqual({
      title: 'Ужин',
      description: '',
      startDate: '2026-11-20',
      startTime: '08:00',
      endDate: '2026-11-21',
      endTime: '00:30',
      participants: { seat1: false, seat2: true },
      category: 'FOOD',
      color: 'TRIP',
    });
  });

  it('keeps the description and both seats; an unknown participant is no seat', () => {
    const value = fromEventResponse(
      { ...EVENT, description: 'с видом', participantIds: ['u-2', 'u-1'] },
      MEMBERS,
    );
    expect(value.description).toBe('с видом');
    expect(value.participants).toEqual({ seat1: true, seat2: true });

    const stranger = fromEventResponse({ ...EVENT, participantIds: ['u-9'] }, MEMBERS);
    expect(stranger.participants).toEqual({ seat1: false, seat2: false });
  });

  it('a member of a seat nobody holds is no seat', () => {
    const value = fromEventResponse(EVENT, MEMBERS.slice(0, 1));

    expect(value.participants).toEqual({ seat1: false, seat2: false });
  });

  it('the form made of it gives the same event back', () => {
    const form = createEventForm(fromEventResponse(EVENT, MEMBERS));

    expect(form.valid).toBe(true);
    expect(toEventRequest(form, MEMBERS, EVENT.version)).toEqual({
      title: 'Ужин',
      description: null,
      start: '2026-11-20T08:00',
      end: '2026-11-21T00:30',
      participantIds: ['u-2'],
      category: 'FOOD',
      color: 'TRIP',
      version: 4,
    });
  });
});

describe('prefillCreate', () => {
  it('EF-10: Friday 19:30 for seat 2 → 19:30–20:30, the second person', () => {
    const value = prefillCreate({ date: '2026-11-20', minute: 1170, personSeat: 2 });

    expect(value).toMatchObject({
      title: '',
      startDate: '2026-11-20',
      startTime: '19:30',
      endDate: '2026-11-20',
      endTime: '20:30',
      participants: { seat1: false, seat2: true },
      category: 'OTHER',
      color: null,
    });
  });

  it('an event started late in the evening ends the next day', () => {
    const value = prefillCreate({ date: '2026-11-20', minute: 23 * 60 + 30, personSeat: 1 });

    expect(value.endDate).toBe('2026-11-21');
    expect(value.endTime).toBe('00:30');
    expect(value.participants).toEqual({ seat1: true, seat2: false });
  });

  it('lasts NEW_EVENT_MINUTES and is valid once it has a title', () => {
    const value = prefillCreate({ date: '2026-11-20', minute: 600, personSeat: 1 });
    const form = createEventForm({ ...value, title: 'Новое' });

    expect(form.valid).toBe(true);
    const request = toEventRequest(form, MEMBERS);
    expect(parseLocalDateTime(request.end) - parseLocalDateTime(request.start)).toBe(
      NEW_EVENT_MINUTES,
    );
  });
});
