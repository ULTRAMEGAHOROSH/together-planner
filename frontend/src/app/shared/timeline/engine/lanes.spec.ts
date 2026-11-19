import { A, ev } from '../testing/event-builder';
import { splitIntoDaySegments } from './day-segments';
import { assignLanes } from './lanes';
import type { LaidOutSegment, Segment } from './model';

const DAY = '2026-11-09';
const range = { firstDay: DAY, dayCount: 1 } as const;

/** Segments of 2026-11-09 for `[from, to, id?]` given as "HH:mm". */
function day(...intervals: [string, string, string?][]): Segment[] {
  const events = intervals.map(([from, to, id]) =>
    ev(
      `${DAY}T${from}`,
      to === '24:00' ? '2026-11-10T00:00' : `${DAY}T${to}`,
      [A],
      id ? { id } : {},
    ),
  );
  return splitIntoDaySegments(events, range, A);
}
/** id → [lane, laneCount] */
const lanesOf = (laidOut: LaidOutSegment[]) =>
  Object.fromEntries(laidOut.map((s) => [s.event.id, [s.lane, s.laneCount]]));

describe('assignLanes (WEEK-03, FD-54)', () => {
  it('LN-01: 09–10 and 11–12 → both lane 0 of 1', () => {
    expect(lanesOf(assignLanes(day(['09:00', '10:00', 'a'], ['11:00', '12:00', 'b'])))).toEqual({
      a: [0, 1],
      b: [0, 1],
    });
  });

  it('LN-02: 09–10 and 10–11 touch → lane 0 of 1, separate clusters', () => {
    expect(lanesOf(assignLanes(day(['09:00', '10:00', 'a'], ['10:00', '11:00', 'b'])))).toEqual({
      a: [0, 1],
      b: [0, 1],
    });
  });

  it('LN-03: 09–11 and 10–12 → lanes 0 and 1 of 2', () => {
    expect(lanesOf(assignLanes(day(['09:00', '11:00', 'a'], ['10:00', '12:00', 'b'])))).toEqual({
      a: [0, 2],
      b: [1, 2],
    });
  });

  it('LN-04: a 09–11, b 10–12, c 11:30–13 → one cluster of 2 lanes: a, c → 0; b → 1', () => {
    const laidOut = assignLanes(
      day(['09:00', '11:00', 'a'], ['10:00', '12:00', 'b'], ['11:30', '13:00', 'c']),
    );
    expect(lanesOf(laidOut)).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2] });
  });

  it('LN-05: three events 09–10 → lanes 0, 1, 2 of 3', () => {
    const laidOut = assignLanes(
      day(['09:00', '10:00', 'a'], ['09:00', '10:00', 'b'], ['09:00', '10:00', 'c']),
    );
    expect(lanesOf(laidOut)).toEqual({ a: [0, 3], b: [1, 3], c: [2, 3] });
  });

  it('LN-06: a cluster (09–11, 10–12) and a lone 14–15 → the lone one is 1 lane wide', () => {
    const laidOut = assignLanes(
      day(['09:00', '11:00', 'a'], ['10:00', '12:00', 'b'], ['14:00', '15:00', 'c']),
    );
    expect(lanesOf(laidOut)).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it('LN-07: same start, 09–12 and 09–10 → the longer one takes lane 0', () => {
    expect(lanesOf(assignLanes(day(['09:00', '10:00', 'a'], ['09:00', '12:00', 'b'])))).toEqual({
      a: [1, 2],
      b: [0, 2],
    });
  });

  it('LN-08: equal intervals, different ids → ordered by id', () => {
    const laidOut = assignLanes(day(['09:00', '10:00', 'z'], ['09:00', '10:00', 'm']));
    expect(laidOut.map((s) => s.event.id)).toEqual(['m', 'z']);
    expect(lanesOf(laidOut)).toEqual({ m: [0, 2], z: [1, 2] });
  });

  it('LN-09: the night-sleep segment 00:00–07:00 and 06:30–08:00 overlap → 2 lanes', () => {
    const sleep = ev('2026-11-08T23:00', `${DAY}T07:00`, [A], { id: 'sleep' });
    const run = ev(`${DAY}T06:30`, `${DAY}T08:00`, [A], { id: 'run' });
    const laidOut = assignLanes(splitIntoDaySegments([sleep, run], range, A));
    expect(lanesOf(laidOut)).toEqual({ sleep: [0, 2], run: [1, 2] });
    expect(laidOut[0].continuesBefore).toBe(true); // the segment fields are kept
  });

  it('an empty day → no segments; the input array is not changed', () => {
    expect(assignLanes([])).toEqual([]);
    const input = day(['10:00', '11:00', 'b'], ['09:00', '12:00', 'a']);
    const ids = input.map((s) => s.event.id);
    assignLanes(input);
    expect(input.map((s) => s.event.id)).toEqual(ids);
  });

  // Deterministic pseudo-random days: up to 12 segments, starts at 15-minute steps.
  function randomDays(count: number): Segment[][] {
    let seed = 7;
    const next = (n: number) => {
      seed = (seed * 16807) % 2147483647; // Park–Miller: exact in doubles
      return seed % n;
    };
    return Array.from({ length: count }, (_, d) => {
      const intervals: [string, string, string][] = [];
      for (let i = 0, n = 1 + next(12); i < n; i++) {
        const start = next(95) * 15;
        const end = Math.min(1440, start + (1 + next(24)) * 15);
        const hhmm = (m: number) =>
          m === 1440
            ? '24:00'
            : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        intervals.push([hhmm(start), hhmm(end), `d${d}-${i}`]);
      }
      return day(...intervals);
    });
  }

  it('invariant: segments of one lane never overlap; every cluster has its own lane count', () => {
    for (const segments of randomDays(200)) {
      const laidOut = assignLanes(segments);
      expect(laidOut).toHaveLength(segments.length);
      for (const s of laidOut) {
        expect(s.lane).toBeGreaterThanOrEqual(0);
        expect(s.lane).toBeLessThan(s.laneCount);
      }
      for (const a of laidOut) {
        for (const b of laidOut) {
          if (a === b) continue;
          const overlap = a.start < b.end && b.start < a.end;
          if (a.lane === b.lane) expect(overlap).toBe(false);
          // Overlapping segments are in one cluster, so they share the lane count.
          if (overlap) expect(a.laneCount).toBe(b.laneCount);
        }
      }
    }
  });

  it('DoD: the result does not depend on the input order (shuffled input)', () => {
    let seed = 99;
    const next = (n: number) => {
      seed = (seed * 16807) % 2147483647;
      return seed % n;
    };
    for (const segments of randomDays(100)) {
      const expected = assignLanes(segments);
      for (let round = 0; round < 5; round++) {
        const shuffled = [...segments];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = next(i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        expect(assignLanes(shuffled)).toEqual(expected);
      }
    }
  });
});
