import type { EventResponse } from '@core/api/models/event.models';
import { EVENT_CREATED_MANUAL } from '@core/api/models/testing/samples';
import { CATEGORY_PALETTE } from '@shared/domain/category-palette';
import { A, B, ev } from '../testing/event-builder';
import type { DayRange } from './model';
import { buildPanelLayout } from './panel-layout';
import { toTimelineEvents } from './to-timeline-events';

const W: DayRange = { firstDay: '2026-11-09', dayCount: 7 };
const TODAY = { today: '2026-11-12' };

describe('buildPanelLayout (WEEK-04)', () => {
  it('PL-01: week W, today 2026-11-12 → today only on Thursday; weekend on Sat and Sun', () => {
    const { days } = buildPanelLayout([], W, A, TODAY);
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-11-12']);
    // Ready texts for the day header and the column button (WEEK-05).
    expect(days.map((d) => `${d.weekdayShort} ${d.dayOfMonth}`)).toEqual([
      'Пн 9',
      'Вт 10',
      'Ср 11',
      'Чт 12',
      'Пт 13',
      'Сб 14',
      'Вс 15',
    ]);
    expect(days[0].dateLabel).toBe('понедельник, 9 ноября');
    expect(days.filter((d) => d.isWeekend).map((d) => d.date)).toEqual([
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  it('PL-02: no events → 7 days without boxes; the panel names its member', () => {
    const panel = buildPanelLayout([], W, B, TODAY);
    expect(panel.personId).toBe(B);
    expect(panel.days).toHaveLength(7);
    expect(panel.days.every((d) => d.boxes.length === 0)).toBe(true);
  });

  it('PL-03: the TL-02 event → a box on Friday and on Saturday with one eventId', () => {
    const night = ev('2026-11-13T23:00', '2026-11-14T07:00', [A]);
    const { days } = buildPanelLayout([night], W, A, TODAY);
    const withBoxes = days.filter((d) => d.boxes.length > 0);
    expect(withBoxes.map((d) => [d.date, d.boxes.map((b) => b.eventId)])).toEqual([
      ['2026-11-13', [night.id]],
      ['2026-11-14', [night.id]],
    ]);
    expect(withBoxes[0].boxes[0].radiusBottom).toBe(3);
    expect(withBoxes[1].boxes[0].radiusTop).toBe(3);
  });

  it('PL-04: color = null → the category palette; an own color → its palette', () => {
    const dto = (category: EventResponse['category'], color: EventResponse['color']) => ({
      ...EVENT_CREATED_MANUAL,
      id: `${category}-${color}`,
      start: '2026-11-09T09:00:00',
      end: '2026-11-09T18:00:00',
      participantIds: [A],
      category,
      color,
    });
    const events = toTimelineEvents([dto('SPORT', null), dto('SPORT', 'TRIP')]);
    const monday = buildPanelLayout(events, W, A, TODAY).days[0];
    const colors = Object.fromEntries(monday.boxes.map((b) => [b.eventId, b.colors]));
    expect(colors['SPORT-null']).toBe(CATEGORY_PALETTE.SPORT);
    expect(colors['SPORT-TRIP']).toBe(CATEGORY_PALETTE.TRIP);
  });

  it('the whole pipeline: only the member’s events, overlapping ones side by side', () => {
    const work = ev('2026-11-10T09:00', '2026-11-10T13:00', [A], { id: 'work' });
    const call = ev('2026-11-10T11:00', '2026-11-10T12:00', [A, B], { id: 'call' });
    const gym = ev('2026-11-10T11:00', '2026-11-10T12:00', [B], { id: 'gym' });
    const tuesday = buildPanelLayout([gym, call, work], W, A, TODAY).days[1];
    expect(tuesday.boxes.map((b) => [b.eventId, b.leftPct, b.widthPct])).toEqual([
      ['work', 0, 50],
      ['call', 50, 50],
    ]);
    expect(tuesday.boxes[1].joint).toBe(true);
    const bTuesday = buildPanelLayout([gym, call, work], W, B, TODAY).days[1];
    expect(bTuesday.boxes.map((b) => [b.eventId, b.widthPct])).toEqual([
      ['call', 50],
      ['gym', 50],
    ]);
  });

  it('a one-day range (the «День» mode); no today for a template preview', () => {
    const night = ev('2026-11-13T23:00', '2026-11-14T07:00', [A]);
    const saturday = buildPanelLayout([night], { firstDay: '2026-11-14', dayCount: 1 }, A, {
      today: null,
    });
    expect(saturday.days).toHaveLength(1);
    expect(saturday.days[0]).toMatchObject({ date: '2026-11-14', isToday: false, isWeekend: true });
    expect(saturday.days[0].boxes.map((b) => [b.top, b.height])).toEqual([[1, 278]]);
  });
});

describe('busyMinutes of a panel (WEEK-17)', () => {
  const minutes = (events: Parameters<typeof buildPanelLayout>[0], range = W, who = A) =>
    buildPanelLayout(events, range, who, TODAY).busyMinutes;

  it('no events: 0', () => {
    expect(minutes([])).toBe(0);
  });

  it("the sum of the member's events, only theirs", () => {
    const events = [
      ev('2026-11-09T09:00', '2026-11-09T13:00', [A]), // 4 h
      ev('2026-11-10T14:00', '2026-11-10T15:30', [A, B]), // 1.5 h, joint: counts for both
      ev('2026-11-10T10:00', '2026-11-10T12:00', [B]), // not A's
    ];
    expect(minutes(events)).toBe(330);
    expect(minutes(events, W, B)).toBe(90 + 120);
  });

  it('sleep is not counted', () => {
    const events = [
      ev('2026-11-09T23:30', '2026-11-10T07:00', [A], { category: 'SLEEP' }),
      ev('2026-11-10T09:00', '2026-11-10T10:00', [A]),
    ];
    expect(minutes(events)).toBe(60);
  });

  it('an event over midnight counts in each day it touches, the part outside the range does not', () => {
    const night = ev('2026-11-15T22:00', '2026-11-16T02:00', [A]); // Sunday 2 h + Monday (outside) 2 h
    expect(minutes([night])).toBe(120);
    const oneDay: DayRange = { firstDay: '2026-11-16', dayCount: 1 };
    expect(minutes([night], oneDay)).toBe(120); // the Monday part
  });

  it('overlapping events are counted each, as in the prototype', () => {
    const events = [
      ev('2026-11-09T09:00', '2026-11-09T11:00', [A]),
      ev('2026-11-09T10:00', '2026-11-09T12:00', [A]),
    ];
    expect(minutes(events)).toBe(240);
  });
});
