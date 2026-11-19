import { parseDate } from '@shared/time/local-date-time';
import { A, B, ev } from '../testing/event-builder';
import { splitIntoDaySegments } from './day-segments';
import type { DayRange, Segment, TimelineEvent } from './model';

// Week W of §8.4: Monday 9 — Sunday 15 November 2026.
const W: DayRange = { firstDay: '2026-11-09', dayCount: 7 };

/** Segments as compact rows: [date, start, end, flags]. */
function rows(segments: Segment[]) {
  return segments.map((s) => [
    s.date,
    s.start,
    s.end,
    (s.continuesBefore ? '<' : '') + (s.continuesAfter ? '>' : ''),
  ]);
}
const split = (event: TimelineEvent, range = W, person = A) =>
  rows(splitIntoDaySegments([event], range, person));

describe('splitIntoDaySegments (WEEK-02, FD-53)', () => {
  it('TL-01: Mon 09:00–10:00 → one segment on Monday', () => {
    expect(split(ev('2026-11-09T09:00', '2026-11-09T10:00', [A]))).toEqual([
      ['2026-11-09', 540, 600, ''],
    ]);
  });

  it('TL-02: Fri 23:00 → Sat 07:00 → Fri to midnight (continues after), Sat from midnight', () => {
    expect(split(ev('2026-11-13T23:00', '2026-11-14T07:00', [A]))).toEqual([
      ['2026-11-13', 1380, 1440, '>'],
      ['2026-11-14', 0, 420, '<'],
    ]);
  });

  it('TL-03: Sun 15.11 23:00 → Mon 16.11 07:00 → only Sunday, continues after', () => {
    expect(split(ev('2026-11-15T23:00', '2026-11-16T07:00', [A]))).toEqual([
      ['2026-11-15', 1380, 1440, '>'],
    ]);
  });

  it('TL-04: Sun 08.11 23:00 → Mon 09.11 07:00 (from last week) → only Monday, continues before', () => {
    expect(split(ev('2026-11-08T23:00', '2026-11-09T07:00', [A]))).toEqual([
      ['2026-11-09', 0, 420, '<'],
    ]);
  });

  it('TL-05: Mon 22:00 → Tue 00:00 → only Monday, not continued, nothing on Tuesday', () => {
    expect(split(ev('2026-11-09T22:00', '2026-11-10T00:00', [A]))).toEqual([
      ['2026-11-09', 1320, 1440, ''],
    ]);
  });

  it('TL-06: Tue 00:00–02:00 → only Tuesday, nothing on Monday', () => {
    expect(split(ev('2026-11-10T00:00', '2026-11-10T02:00', [A]))).toEqual([
      ['2026-11-10', 0, 120, ''],
    ]);
  });

  it('TL-07: Fri 08:00 → Sun 20:00 → three days, the middle one whole', () => {
    expect(split(ev('2026-11-13T08:00', '2026-11-15T20:00', [A]))).toEqual([
      ['2026-11-13', 480, 1440, '>'],
      ['2026-11-14', 0, 1440, '<>'],
      ['2026-11-15', 0, 1200, '<'],
    ]);
  });

  it('TL-08: 01.11 → 30.11 (longer than the week) → 7 whole days', () => {
    const segments = splitIntoDaySegments([ev('2026-11-01T00:00', '2026-11-30T00:00', [A])], W, A);
    expect(segments.map((s) => s.dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(
      rows(segments).every(
        ([, start, end, flags]) => start === 0 && end === 1440 && flags === '<>',
      ),
    ).toBe(true);
  });

  it('TL-09: an event of B → nothing in the panel of A', () => {
    expect(split(ev('2026-11-09T09:00', '2026-11-09T10:00', [B]))).toEqual([]);
  });

  it('TL-10: a joint event [A, B] → a segment in each panel, joint', () => {
    const joint = ev('2026-11-11T19:00', '2026-11-11T21:00', [B, A]);
    for (const person of [A, B]) {
      const segments = splitIntoDaySegments([joint], W, person);
      expect(rows(segments)).toEqual([['2026-11-11', 1140, 1260, '']]);
      expect(segments[0].event.joint).toBe(true);
      expect(segments[0].event).toBe(joint);
    }
  });

  it('TL-11: an event wholly in the next week → nothing; so is one wholly before', () => {
    expect(split(ev('2026-11-16T00:00', '2026-11-16T09:00', [A]))).toEqual([]);
    expect(split(ev('2026-11-08T20:00', '2026-11-09T00:00', [A]))).toEqual([]);
  });

  it('TL-12: one-day range with the TL-02 event → only the segment of that day', () => {
    const night = ev('2026-11-13T23:00', '2026-11-14T07:00', [A]);
    expect(split(night, { firstDay: '2026-11-14', dayCount: 1 })).toEqual([
      ['2026-11-14', 0, 420, '<'],
    ]);
    expect(split(night, { firstDay: '2026-11-13', dayCount: 1 })).toEqual([
      ['2026-11-13', 1380, 1440, '>'],
    ]);
    const [segment] = splitIntoDaySegments([night], { firstDay: '2026-11-14', dayCount: 1 }, A);
    expect(segment.dayIndex).toBe(0);
  });

  it('keeps the input order of the events, days ascending within each', () => {
    const later = ev('2026-11-12T09:00', '2026-11-12T10:00', [A]);
    const night = ev('2026-11-10T23:00', '2026-11-11T01:00', [A]);
    const segments = splitIntoDaySegments([later, night], W, A);
    expect(segments.map((s) => [s.event.id, s.date])).toEqual([
      [later.id, '2026-11-12'],
      [night.id, '2026-11-10'],
      [night.id, '2026-11-11'],
    ]);
  });

  it('invariant: the segments add up to the part of the event inside the range', () => {
    const rangeStart = parseDate(W.firstDay);
    const rangeEnd = rangeStart + W.dayCount * 1440;
    // Deterministic pseudo-random events around the week: starts from Fri 06.11 to
    // Tue 17.11 at 15-minute steps, durations from 15 minutes to 3 days.
    let seed = 42;
    const next = (n: number) => {
      seed = (seed * 16807) % 2147483647; // Park–Miller: exact in doubles
      return seed % n;
    };
    const base = parseDate('2026-11-06');
    for (let i = 0; i < 500; i++) {
      const startMin = base + next(11 * 96) * 15;
      const endMin = startMin + (1 + next(3 * 96)) * 15;
      const event = { ...ev('2026-11-09T00:00', '2026-11-09T00:15', [A]), startMin, endMin };
      const segments = splitIntoDaySegments([event], W, A);
      const total = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
      const inside = Math.max(0, Math.min(endMin, rangeEnd) - Math.max(startMin, rangeStart));
      expect(total).toBe(inside);
      for (const s of segments) {
        expect(s.start >= 0 && s.start < s.end && s.end <= 1440).toBe(true);
        expect(s.continuesBefore).toBe(s.start === 0 && startMin < rangeStart + s.dayIndex * 1440);
        expect(s.continuesAfter).toBe(
          s.end === 1440 && endMin > rangeStart + (s.dayIndex + 1) * 1440,
        );
      }
    }
  });
});
