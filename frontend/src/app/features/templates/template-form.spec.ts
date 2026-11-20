import {
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WEEK,
} from '@core/api/models/testing/samples';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { ApiError } from '@core/error/api-error';
import { ERROR_MESSAGES, FIELD_ERROR_MESSAGES } from '@core/error/error-messages';
import { applyServerErrors } from '@shared/forms/server-errors';
import {
  addTemplateEvent,
  createTemplateEventRow,
  createTemplateForm,
  durationOf,
  fromTemplateResponse,
  removeTemplateEvent,
  TEMPLATE_SERVER_ERRORS,
  type TemplateEventFormValue,
  templateEventFieldError,
  templateFormError,
  toTemplateRequest,
} from './template-form';

const MEMBERS = WEEK.members as unknown as readonly MemberResponse[];

/** Monday 09:00–13:00 for the first member: a valid row. */
const VALID: Partial<TemplateEventFormValue> = {
  title: 'Работа',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '13:00',
  endDayOffset: 0,
  participants: { seat1: true, seat2: false },
};

const row = (value: Partial<TemplateEventFormValue> = {}) =>
  createTemplateEventRow({ ...VALID, ...value });

describe('template event row: duration (TF-01…TF-04)', () => {
  it('TF-01: 09:00–13:00 with offset 0 is 240 minutes', () => {
    const form = createTemplateForm({ name: 'Н', events: [{ ...EMPTY_ROW, ...VALID }] });
    expect(toTemplateRequest(form, MEMBERS).events[0].durationMinutes).toBe(240);
    expect(form.valid).toBe(true);
  });

  it('TF-02: typing an end earlier than the start moves the end to «+1 день»', () => {
    const r = row({ startTime: '23:00', endTime: '23:30' });
    r.controls.endTime.setValue('07:00');
    expect(r.controls.endDayOffset.value).toBe(1);
    expect(durationOf(r.getRawValue())).toBe(480);
    expect(r.valid).toBe(true);
  });

  it('TF-02: moving the start past the end does the same', () => {
    const r = row({ startTime: '09:00', endTime: '10:00' });
    r.controls.startTime.setValue('23:00');
    expect(r.controls.endDayOffset.value).toBe(1);
    expect(durationOf(r.getRawValue())).toBe(660);
  });

  it('the automatic day does not touch a row that already has a day, or a later end', () => {
    const r = row({ startTime: '23:00', endTime: '07:00', endDayOffset: 2 });
    r.controls.endTime.setValue('06:00');
    expect(r.controls.endDayOffset.value).toBe(2);
    const later = row();
    later.controls.endTime.setValue('15:00');
    expect(later.controls.endDayOffset.value).toBe(0);
  });

  it('a row filled from the server is not changed by the automatic day', () => {
    const r = row({ startTime: '23:00', endTime: '07:00', endDayOffset: 1 });
    expect(r.controls.endDayOffset.value).toBe(1);
  });

  it('TF-03: 08:00–08:00 with offset 0 is 0 minutes — an error under the end', () => {
    const r = row({ startTime: '08:00', endTime: '08:00' });
    expect(durationOf(r.getRawValue())).toBe(0);
    expect(r.valid).toBe(false);
    expect(templateEventFieldError(r, 'end')).toBe(ERROR_MESSAGES.EVENT_END_NOT_AFTER_START);
    expect(r.controls.endDayOffset.value).toBe(0);
  });

  it('TF-04: offset 6, 00:00 → 23:59 is 10079 — valid; one minute more is not', () => {
    const r = row({ startTime: '00:00', endTime: '23:59', endDayOffset: 6 });
    expect(durationOf(r.getRawValue())).toBe(10079);
    expect(r.valid).toBe(true);
    const over = row({ startTime: '00:00', endTime: '00:30', endDayOffset: 7 });
    expect(over.valid).toBe(false);
    expect(templateEventFieldError(over, 'end')).toBe(FIELD_ERROR_MESSAGES.templateEventTooLong);
    // Exactly a week is allowed by the backend and must survive a round trip.
    expect(row({ startTime: '00:00', endTime: '00:00', endDayOffset: 7 }).valid).toBe(true);
  });

  it('an offset beyond 0..7, or a missing time, is an error of its own field', () => {
    expect(row({ endDayOffset: 8 }).controls.endDayOffset.valid).toBe(false);
    expect(row({ endDayOffset: -1 }).controls.endDayOffset.valid).toBe(false);
    const empty = row({ startTime: '' });
    expect(empty.controls.startTime.errors).toEqual({ required: true });
    expect(templateEventFieldError(empty, 'start')).toBe(FIELD_ERROR_MESSAGES.required);
    expect(durationOf(empty.getRawValue())).toBeNull();
  });
});

const EMPTY_ROW = createTemplateEventRow().getRawValue();

describe('template event row: fields', () => {
  it('title: required, ≤ 100 after trim', () => {
    expect(row({ title: '   ' }).controls.title.valid).toBe(false);
    expect(row({ title: ` ${'а'.repeat(100)} ` }).controls.title.valid).toBe(true);
    expect(row({ title: 'а'.repeat(101) }).controls.title.valid).toBe(false);
  });

  it('description ≤ 2000, participants: at least one', () => {
    expect(row({ description: 'а'.repeat(2001) }).controls.description.valid).toBe(false);
    const none = row({ participants: { seat1: false, seat2: false } });
    expect(templateEventFieldError(none, 'participants')).toBe(FIELD_ERROR_MESSAGES.noParticipants);
  });

  it('a field that is fine has no error', () => {
    const r = row();
    for (const field of ['title', 'description', 'start', 'end', 'participants'] as const) {
      expect(templateEventFieldError(r, field)).toBeNull();
    }
  });
});

describe('template form', () => {
  it('an empty form is not valid; name is required and ≤ 60 after trim', () => {
    const form = createTemplateForm();
    expect(form.valid).toBe(false);
    form.controls.name.setValue(' Неделя ');
    expect(form.valid).toBe(true);
    form.controls.name.setValue('н'.repeat(61));
    expect(form.controls.name.valid).toBe(false);
    form.controls.description.setValue('о'.repeat(501));
    expect(form.controls.description.valid).toBe(false);
  });

  it('TF-06: a new row has id null', () => {
    const form = createTemplateForm({ name: 'Н' });
    const added = addTemplateEvent(form, { ...VALID, id: 'must-not-stick' });
    expect(added.controls.id.value).toBeNull();
    expect(toTemplateRequest(form, MEMBERS).events[0].id).toBeNull();
  });

  it('TF-07: 301 events is a form error, 300 is fine', () => {
    const form = createTemplateForm({ name: 'Н' });
    for (let i = 0; i < 300; i++) addTemplateEvent(form, VALID);
    expect(form.valid).toBe(true);
    expect(templateFormError(form)).toBeNull();
    addTemplateEvent(form, VALID);
    expect(form.valid).toBe(false);
    expect(templateFormError(form)).toBe(FIELD_ERROR_MESSAGES.templateEventsMax(300));
    removeTemplateEvent(form, 0);
    expect(form.valid).toBe(true);
  });

  it('TF-08: TEMPLATE_NAME_TAKEN is an error of the name, gone on the next edit', () => {
    const form = createTemplateForm({ name: 'Н' });
    const handled = applyServerErrors(
      form,
      new ApiError('TEMPLATE_NAME_TAKEN', { status: 409 }),
      TEMPLATE_SERVER_ERRORS,
    );
    expect(handled).toBe(true);
    expect(form.controls.name.errors).toEqual({ server: ERROR_MESSAGES.TEMPLATE_NAME_TAKEN });
    form.controls.name.setValue('Другое');
    expect(form.controls.name.errors).toBeNull();
  });

  it('TEMPLATE_EVENT_NOT_FOUND and EVENT_PARTICIPANT_NOT_MEMBER go to the form as a whole', () => {
    for (const code of ['TEMPLATE_EVENT_NOT_FOUND', 'EVENT_PARTICIPANT_NOT_MEMBER'] as const) {
      const form = createTemplateForm({ name: 'Н' });
      expect(
        applyServerErrors(form, new ApiError(code, { status: 404 }), TEMPLATE_SERVER_ERRORS),
      ).toBe(true);
      expect(templateFormError(form)).toBe(ERROR_MESSAGES[code]);
      expect(form.controls.name.errors).toBeNull();
    }
  });

  it('a validation error of a row field lands on that field', () => {
    const form = createTemplateForm({ name: 'Н', events: [{ ...EMPTY_ROW, ...VALID }] });
    applyServerErrors(
      form,
      new ApiError('VALIDATION_FAILED', {
        status: 400,
        fieldErrors: { 'events[0].title': ['x'] },
      }),
      TEMPLATE_SERVER_ERRORS,
    );
    expect(templateEventFieldError(form.controls.events.at(0), 'title')).toBe(
      FIELD_ERROR_MESSAGES.invalid,
    );
  });
});

describe('toTemplateRequest / fromTemplateResponse', () => {
  it('TF-05: from the server and back without edits: same ids, fields and durations', () => {
    const form = createTemplateForm(fromTemplateResponse(TEMPLATE_WITH_LAST_APPLICATION, MEMBERS));
    expect(form.valid).toBe(true);
    const request = toTemplateRequest(form, MEMBERS);
    const expected = TEMPLATE_WITH_LAST_APPLICATION.events.map((e) => ({
      ...e,
      // The frontend sends HH:mm; the server answers HH:mm:ss.
      startTime: e.startTime.slice(0, 5),
      // Participants are a set: the request lists them in seat order.
      participantIds: MEMBERS.map((m) => m.userId).filter((id) => e.participantIds.includes(id)),
    }));
    expect(request.events).toEqual(expected);
    expect(request.events.map((e) => e.id)).toEqual(
      TEMPLATE_WITH_LAST_APPLICATION.events.map((e) => e.id),
    );
    expect(request.name).toBe(TEMPLATE_WITH_LAST_APPLICATION.name);
    expect(request.description).toBeNull();
    expect('version' in request).toBe(false);
  });

  it('the end of a night event comes back as «+1 день»; a week as offset 7', () => {
    const night = { ...TEMPLATE_CREATED.events[2], startTime: '23:00:00', durationMinutes: 480 };
    const week = { ...TEMPLATE_CREATED.events[0], startTime: '00:00:00', durationMinutes: 10080 };
    const value = fromTemplateResponse({ ...TEMPLATE_CREATED, events: [night, week] }, MEMBERS);
    expect(value.events[0]).toMatchObject({
      startTime: '23:00',
      endTime: '07:00',
      endDayOffset: 1,
    });
    expect(value.events[1]).toMatchObject({
      startTime: '00:00',
      endTime: '00:00',
      endDayOffset: 7,
    });
    const request = toTemplateRequest(createTemplateForm(value), MEMBERS);
    expect(request.events.map((e) => e.durationMinutes)).toEqual([480, 10080]);
  });

  it('version only for an edit, including 0; texts are trimmed, empty description is null', () => {
    const form = createTemplateForm({
      name: '  Неделя ',
      description: '   ',
      events: [{ ...EMPTY_ROW, ...VALID, title: ' Работа ', description: ' ' }],
    });
    const created = toTemplateRequest(form, MEMBERS);
    expect(created).toMatchObject({ name: 'Неделя', description: null });
    expect(created.events[0]).toMatchObject({ title: 'Работа', description: null });
    expect(toTemplateRequest(form, MEMBERS, 0).version).toBe(0);
    expect(toTemplateRequest(form, MEMBERS, 5).version).toBe(5);
  });

  it('participants go by seat, in seat order; a seat nobody has taken is left out', () => {
    const both = createTemplateForm({
      name: 'Н',
      events: [{ ...EMPTY_ROW, ...VALID, participants: { seat1: true, seat2: true } }],
    });
    expect(toTemplateRequest(both, MEMBERS).events[0].participantIds).toEqual([
      MEMBERS[0].userId,
      MEMBERS[1].userId,
    ]);
    expect(toTemplateRequest(both, [MEMBERS[0]]).events[0].participantIds).toEqual([
      MEMBERS[0].userId,
    ]);
  });

  it('the id of an existing row survives edits, and a removed row is simply absent', () => {
    const form = createTemplateForm(fromTemplateResponse(TEMPLATE_CREATED, MEMBERS));
    const [first, second] = TEMPLATE_CREATED.events;
    form.controls.events.at(0).controls.title.setValue('Другое');
    form.controls.events.at(0).controls.startTime.setValue('10:00');
    removeTemplateEvent(form, 2);
    addTemplateEvent(form, VALID);
    const ids = toTemplateRequest(form, MEMBERS).events.map((e) => e.id);
    expect(ids).toEqual([first.id, second.id, null]);
  });
});
