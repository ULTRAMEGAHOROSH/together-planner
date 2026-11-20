import { PX_PER_HOUR } from './constants';
import { buildPanelLayout } from './panel-layout';
import {
  TEMPLATE_WEEK_START,
  type TemplatePreviewEvent,
  templateToTimelineEvents,
} from './template-to-timeline';

const ME = 'user-1';
const event = (patch: Partial<TemplatePreviewEvent>): TemplatePreviewEvent => ({
  id: 'e1',
  title: 'Сон',
  dayOfWeek: 'SUNDAY',
  startTime: '23:00',
  durationMinutes: 480,
  participantIds: [ME],
  category: 'SLEEP',
  color: null,
  ...patch,
});
const layout = (events: TemplatePreviewEvent[], withDates = false) =>
  buildPanelLayout(
    templateToTimelineEvents(events),
    { firstDay: TEMPLATE_WEEK_START, dayCount: 7 },
    ME,
    { today: null, withDates },
  );
const range = (box: { top: number; height: number }) => [
  box.top / PX_PER_HOUR,
  (box.top + box.height) / PX_PER_HOUR,
];

describe('templateToTimelineEvents (TPL-09)', () => {
  it('the conditional week starts on a Monday', () => {
    expect(layout([]).days.map((d) => d.weekdayShort)).toEqual([
      'Пн',
      'Вт',
      'Ср',
      'Чт',
      'Пт',
      'Сб',
      'Вс',
    ]);
  });

  it('«Сон вс 23:00 + 480» shows Sunday 23–24 and Monday 00–07 of the same week', () => {
    const days = layout([event({})]).days;
    expect(days[6].boxes).toHaveLength(1);
    const [from, to] = range(days[6].boxes[0]);
    expect(from).toBeCloseTo(23, 0); // the card keeps a 1 px gap
    expect(to).toBeCloseTo(24, 0);
    expect(days[0].boxes).toHaveLength(1);
    const [monFrom, monTo] = range(days[0].boxes[0]);
    expect(monFrom).toBeCloseTo(0, 0);
    expect(monTo).toBeCloseTo(7, 0);
    // Both parts are the same event: a click on either finds the same row.
    expect(days[0].boxes[0].eventId).toBe(days[6].boxes[0].eventId);
  });

  it('an event inside the week is one box; one that crosses midnight inside the week splits by day', () => {
    const days = layout([
      event({ id: 'a', dayOfWeek: 'MONDAY', startTime: '08:00', durationMinutes: 540 }),
      event({ id: 'b', dayOfWeek: 'TUESDAY', startTime: '22:00', durationMinutes: 180 }),
    ]).days;
    expect(days[0].boxes.map((b) => b.eventId)).toEqual(['a']);
    expect(days[1].boxes).toHaveLength(1);
    expect(days[2].boxes).toHaveLength(1);
  });

  it('an event of the whole week does not meet itself', () => {
    const events = templateToTimelineEvents([
      event({ dayOfWeek: 'WEDNESDAY', startTime: '10:00', durationMinutes: 10080 }),
    ]);
    expect(events).toHaveLength(2);
    expect(events[1].endMin).toBeLessThanOrEqual(events[0].startMin);
  });

  it('participants, the joint flag and the color of the category or of its own', () => {
    const [own, , shared] = templateToTimelineEvents([
      event({ color: 'WORK' }),
      event({ participantIds: [ME, 'user-2'], dayOfWeek: 'MONDAY' }),
    ]);
    expect(own.color).toBe('WORK');
    expect(own.joint).toBe(false);
    expect(shared.color).toBe('SLEEP');
    expect(shared.joint).toBe(true);
  });

  it('the panel of a person shows only their events; without dates the headers have no numbers', () => {
    const panel = buildPanelLayout(
      templateToTimelineEvents([event({ participantIds: ['user-2'] })]),
      { firstDay: TEMPLATE_WEEK_START, dayCount: 7 },
      ME,
      { today: null, withDates: false },
    );
    expect(panel.days.flatMap((d) => d.boxes)).toHaveLength(0);
    expect(panel.days.every((d) => d.dayOfMonth === null)).toBe(true);
    expect(layout([], true).days[0].dayOfMonth).toBe(1);
  });
});
