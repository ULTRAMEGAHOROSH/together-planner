import { A, B, ev } from '../testing/event-builder';
import { freeIntervals, freeSlotBoxes } from './free-slots';

const DAY = '2026-11-12';
const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe('free-slots (WEEK-15)', () => {
  it('FS-01: an empty day is one interval 07:00–23:00', () => {
    expect(freeIntervals([], DAY)).toEqual([{ start: h(7), end: h(23) }]);
  });

  it('FS-02: A 09–18 and B 10–19 leave 07:00–09:00 and 19:00–23:00', () => {
    const events = [
      ev(`${DAY}T09:00`, `${DAY}T18:00`, [A]),
      ev(`${DAY}T10:00`, `${DAY}T19:00`, [B]),
    ];
    expect(freeIntervals(events, DAY)).toEqual([
      { start: h(7), end: h(9) },
      { start: h(19), end: h(23) },
    ]);
  });

  it('FS-03: a gap of 25 minutes is not shown, 30 is', () => {
    const short = [
      ev(`${DAY}T07:00`, `${DAY}T12:00`, [A]),
      ev(`${DAY}T12:25`, `${DAY}T23:00`, [B]),
    ];
    expect(freeIntervals(short, DAY)).toEqual([]);
    const enough = [
      ev(`${DAY}T07:00`, `${DAY}T12:00`, [A]),
      ev(`${DAY}T12:30`, `${DAY}T23:00`, [B]),
    ];
    expect(freeIntervals(enough, DAY)).toEqual([{ start: h(12), end: h(12, 30) }]);
  });

  it("FS-04: a night's sleep 23:30 → 07:00 does not touch the window", () => {
    const sleep = ev('2026-11-11T23:30', `${DAY}T07:00`, [A]);
    expect(freeIntervals([sleep], DAY)).toEqual([{ start: h(7), end: h(23) }]);
    const next = ev(`${DAY}T23:30`, '2026-11-13T07:00', [A]);
    expect(freeIntervals([next], DAY)).toEqual([{ start: h(7), end: h(23) }]);
  });

  it('FS-05: a joint event 20:00–22:00 is excluded from the free time', () => {
    const joint = ev(`${DAY}T20:00`, `${DAY}T22:00`, [A, B]);
    expect(freeIntervals([joint], DAY)).toEqual([
      { start: h(7), end: h(20) },
      { start: h(22), end: h(23) },
    ]);
  });

  it('overlapping and nested events do not make a gap; an event over the window edge is clipped', () => {
    const events = [
      ev(`${DAY}T08:00`, `${DAY}T14:00`, [A]),
      ev(`${DAY}T09:00`, `${DAY}T10:00`, [B]), // inside the first
      ev(`${DAY}T13:00`, `${DAY}T15:00`, [B]), // overlaps its end
      ev('2026-11-11T20:00', `${DAY}T07:30`, [A]), // from the night into the window
      ev(`${DAY}T22:30`, '2026-11-13T02:00', [B]), // out of the window at the bottom
    ];
    expect(freeIntervals(events, DAY)).toEqual([
      { start: h(7, 30), end: h(8) }, // between the night's end and the first event
      { start: h(15), end: h(22, 30) },
    ]);
  });

  it("another day's events are not counted", () => {
    expect(freeIntervals([ev('2026-11-13T09:00', '2026-11-13T18:00', [A])], DAY)).toEqual([
      { start: h(7), end: h(23) },
    ]);
  });

  it("boxes: the prototype's top, height, time and the heights that show the label and the time", () => {
    const events = [
      ev(`${DAY}T09:00`, `${DAY}T18:00`, [A]),
      ev(`${DAY}T18:30`, `${DAY}T22:30`, [B]),
    ];
    expect(freeSlotBoxes(events, DAY)).toEqual([
      // 07:00–09:00: 2 h = 120 min → 80 px − 2 = 78; label and time fit.
      {
        key: 'f420',
        top: 281,
        height: 78,
        timeLabel: '07:00–09:00',
        showLabel: true,
        showTime: true,
      },
      // 18:00–18:30: 30 min → 20 px − 2 = 18; neither fits.
      {
        key: 'f1080',
        top: 721,
        height: 18,
        timeLabel: '18:00–18:30',
        showLabel: false,
        showTime: false,
      },
      // 22:30–23:00 likewise.
      {
        key: 'f1350',
        top: 901,
        height: 18,
        timeLabel: '22:30–23:00',
        showLabel: false,
        showTime: false,
      },
    ]);
    // 45 min → 30 − 2 = 28 (no label), 60 min → 40 − 2 = 38 (label, no time), 66 min → 44 − 2 = 42.
    const heights = [45, 60, 70].map((m) => {
      const gap = [
        ev(`${DAY}T07:00`, `${DAY}T10:00`, [A]),
        ev(
          `${DAY}T${String(10 + Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
          `${DAY}T23:00`,
          [B],
        ),
      ];
      const [box] = freeSlotBoxes(gap, DAY);
      return [box.height, box.showLabel, box.showTime];
    });
    expect(heights).toEqual([
      [28, false, false],
      [38, true, false],
      [45, true, true],
    ]);
  });
});
