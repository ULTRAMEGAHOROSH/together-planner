import { WEEK } from '@core/api/models/testing/samples';
import type { EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { defaultTemplateName, weekToTemplate } from './week-to-template';

const MEMBERS = WEEK.members as unknown as MemberResponse[];
const [A, B] = MEMBERS;
const MONDAY = '2026-11-16';
const event = (patch: Partial<EventResponse>): EventResponse => ({
  ...(WEEK.events[0] as unknown as EventResponse),
  id: 'e',
  title: 'Событие',
  description: null,
  start: '2026-11-17T08:00:00',
  end: '2026-11-17T09:30:00',
  participantIds: [A.userId],
  category: 'WORK',
  color: null,
  source: null,
  ...patch,
});
const events = (draft: ReturnType<typeof weekToTemplate>) => draft.request?.events ?? [];

describe('weekToTemplate (TPL-12, OQ-3)', () => {
  it('the name has the week and the year; the description names the week', () => {
    expect(defaultTemplateName(MONDAY)).toBe('Неделя 16–22 нояб. 2026');
    const draft = weekToTemplate(MONDAY, [event({})], MEMBERS);
    expect(draft.request?.name).toBe('Неделя 16–22 нояб. 2026');
    expect(draft.request?.description).toBe('Создан из недели 16 – 22 ноября 2026');
    expect(weekToTemplate(MONDAY, [event({})], MEMBERS, 'Моя неделя').request?.name).toBe(
      'Моя неделя',
    );
  });

  it('an event of the week: its day, start, length, people, category and color', () => {
    const [taken] = events(
      weekToTemplate(
        MONDAY,
        [
          event({
            title: ' Работа ',
            description: 'д',
            participantIds: [B.userId, A.userId],
            category: 'SPORT',
            color: 'TRIP',
          }),
        ],
        MEMBERS,
      ),
    );
    expect(taken).toEqual({
      id: null,
      title: ' Работа ',
      description: 'д',
      dayOfWeek: 'TUESDAY',
      startTime: '08:00',
      durationMinutes: 90,
      participantIds: [A.userId, B.userId], // seat order
      category: 'SPORT',
      color: 'TRIP',
    });
  });

  it('events from templates are taken like manual ones, and carry no source into the request', () => {
    const fromTemplate = event({ source: { templateEventId: 'x' } as never });
    const draft = weekToTemplate(MONDAY, [fromTemplate], MEMBERS);
    expect(draft.count).toBe(1);
    expect(Object.keys(events(draft)[0])).not.toContain('source');
  });

  it('an event starting Sunday night goes on into Monday: kept with its length', () => {
    const draft = weekToTemplate(
      MONDAY,
      [event({ start: '2026-11-22T23:00:00', end: '2026-11-23T07:00:00' })],
      MEMBERS,
    );
    expect(events(draft)[0]).toMatchObject({
      dayOfWeek: 'SUNDAY',
      startTime: '23:00',
      durationMinutes: 480,
    });
  });

  it('an event that started before Monday belongs to the last week: skipped and named', () => {
    const draft = weekToTemplate(
      MONDAY,
      [event({ title: 'Сон', start: '2026-11-15T23:00:00', end: '2026-11-16T07:00:00' })],
      MEMBERS,
    );
    expect(draft.count).toBe(0);
    expect(draft.skipped).toEqual([{ title: 'Сон', reason: 'startedEarlier' }]);
  });

  it('an event starting exactly at the next Monday is not in this week', () => {
    const draft = weekToTemplate(
      MONDAY,
      [event({ start: '2026-11-23T00:00:00', end: '2026-11-23T01:00:00' })],
      MEMBERS,
    );
    expect(draft.count).toBe(0);
    expect(draft.skipped).toEqual([]);
  });

  it('longer than a week: cut to 10080 and named; exactly a week is not cut', () => {
    const draft = weekToTemplate(
      MONDAY,
      [
        event({ title: 'Отпуск', start: '2026-11-16T00:00:00', end: '2026-12-10T00:00:00' }),
        event({ title: 'Неделя', start: '2026-11-16T00:00:00', end: '2026-11-23T00:00:00' }),
      ],
      MEMBERS,
    );
    expect(events(draft).map((e) => e.durationMinutes)).toEqual([10080, 10080]);
    expect(draft.clamped).toEqual([{ title: 'Отпуск' }]);
  });

  it('people who left are dropped; with nobody left the event is skipped and named', () => {
    const draft = weekToTemplate(
      MONDAY,
      [
        event({ id: '1', participantIds: [A.userId, 'gone'] }),
        event({ id: '2', title: 'Чужое', participantIds: ['gone'] }),
      ],
      MEMBERS,
    );
    expect(events(draft)[0].participantIds).toEqual([A.userId]);
    expect(draft.skipped).toEqual([{ title: 'Чужое', reason: 'noParticipants' }]);
  });

  it('an event without length is skipped', () => {
    const draft = weekToTemplate(
      MONDAY,
      [event({ title: 'Ноль', end: '2026-11-17T08:00:00' })],
      MEMBERS,
    );
    expect(draft.skipped).toEqual([{ title: 'Ноль', reason: 'noLength' }]);
  });

  it('events are in the order of their start, whatever the order they came in', () => {
    const draft = weekToTemplate(
      MONDAY,
      [
        event({ id: 'late', title: 'B', start: '2026-11-18T10:00:00', end: '2026-11-18T11:00:00' }),
        event({
          id: 'early',
          title: 'A',
          start: '2026-11-16T10:00:00',
          end: '2026-11-16T11:00:00',
        }),
      ],
      MEMBERS,
    );
    expect(events(draft).map((e) => e.title)).toEqual(['A', 'B']);
  });

  it('over 300 events nothing is built and nothing is cut; exactly 300 is fine', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => event({ id: `e${i}`, title: `E${i}` }));
    const over = weekToTemplate(MONDAY, many(301), MEMBERS);
    expect(over.tooMany).toBe(true);
    expect(over.request).toBeNull();
    expect(over.count).toBe(301);
    const exact = weekToTemplate(MONDAY, many(300), MEMBERS);
    expect(exact.tooMany).toBe(false);
    expect(events(exact)).toHaveLength(300);
  });

  it('a week without events gives an empty draft', () => {
    const draft = weekToTemplate(MONDAY, [], MEMBERS);
    expect(draft.count).toBe(0);
    expect(events(draft)).toEqual([]);
  });
});
