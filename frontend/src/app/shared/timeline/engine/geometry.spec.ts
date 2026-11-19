import { CATEGORY_PALETTE } from '@shared/domain/category-palette';
import { A, B, ev } from '../testing/event-builder';
import { splitIntoDaySegments } from './day-segments';
import { toBox } from './geometry';
import type { LaidOutSegment, TimelineEvent } from './model';

const W = { firstDay: '2026-11-09', dayCount: 7 } as const;

/** The first segment of the event in week W, in lane `lane` of `laneCount`. */
function seg(event: TimelineEvent, lane = 0, laneCount = 1, index = 0): LaidOutSegment {
  return { ...splitIntoDaySegments([event], W, A)[index], lane, laneCount };
}
/** A box of an event on Monday 09.11 from 09:00 lasting `minutes`. */
function boxOf(minutes: number) {
  const startMin = ev('2026-11-09T09:00', '2026-11-09T10:00', [A]).startMin;
  return toBox(
    seg(ev('2026-11-09T09:00', '2026-11-09T10:00', [A], { endMin: startMin + minutes })),
  );
}

describe('toBox (WEEK-04, FD-56)', () => {
  it('GM-01: [540; 600) → top 360 + 1, height 40 − 2', () => {
    const box = boxOf(60);
    expect([box.top, box.height]).toEqual([361, 38]);
    expect([box.leftPct, box.widthPct]).toEqual([0, 100]);
    expect([box.radiusTop, box.radiusBottom]).toEqual([8, 8]);
  });

  it('GM-02: 5 minutes → the minimal height 14', () => {
    expect(boxOf(5).height).toBe(14);
  });

  it('GM-03: lane 1 of 3 → a third of the column, the second third', () => {
    const box = toBox(seg(ev('2026-11-09T09:00', '2026-11-09T10:00', [A]), 1, 3));
    expect(box.leftPct).toBeCloseTo(33.333, 3);
    expect(box.widthPct).toBeCloseTo(33.333, 3);
    expect(toBox(seg(ev('2026-11-09T09:00', '2026-11-09T10:00', [A]), 2, 3)).leftPct).toBeCloseTo(
      66.667,
      3,
    );
  });

  it('GM-04 / GM-05: the edge that continues into another day gets radius 3', () => {
    const night = ev('2026-11-13T23:00', '2026-11-14T07:00', [A]);
    const friday = toBox(seg(night, 0, 1, 0));
    const saturday = toBox(seg(night, 0, 1, 1));
    expect([friday.radiusTop, friday.radiusBottom]).toEqual([8, 3]); // continues after
    expect([saturday.radiusTop, saturday.radiusBottom]).toEqual([3, 8]); // continues before
    expect([saturday.top, saturday.height]).toEqual([1, 278]); // 00:00–07:00
  });

  it('GM-06: density by height (prototype): tall from 36 px, tiny below 20 px', () => {
    const view = (minutes: number) => {
      const box = boxOf(minutes);
      return [box.height, box.density, box.fontSize];
    };
    expect(view(60)).toEqual([38, 'tall', 12]);
    expect(view(57)).toEqual([36, 'tall', 12]); // 38 − 2 = 36: exactly the threshold
    expect(view(56)).toEqual([35, 'short', 12]); // 35.33
    expect(view(33)).toEqual([20, 'short', 12]); // 22 − 2 = 20
    expect(view(32)).toEqual([19, 'tiny', 10.5]); // 19.33
    expect(view(5)).toEqual([14, 'tiny', 10.5]);
  });

  it('GM-07: the name of a joint card: title, rangeText and «вместе»', () => {
    const joint = ev('2026-11-11T19:00', '2026-11-11T21:00', [A, B], { title: 'Ужин' });
    expect(toBox(seg(joint)).ariaLabel).toBe('Ужин, Ср, 11 нояб. · 19:00–21:00, вместе');
    const alone = ev('2026-11-11T19:00', '2026-11-11T21:00', [A], { title: 'Ужин' });
    expect(toBox(seg(alone)).ariaLabel).toBe('Ужин, Ср, 11 нояб. · 19:00–21:00');
  });

  it('time and name are of the whole event on every day it touches', () => {
    const night = ev('2026-11-13T23:00', '2026-11-14T07:00', [A], { title: 'Сон', id: 'n1' });
    const [friday, saturday] = [toBox(seg(night, 0, 1, 0)), toBox(seg(night, 0, 1, 1))];
    for (const box of [friday, saturday]) {
      expect(box.timeLabel).toBe('23:00–07:00');
      expect(box.ariaLabel).toBe('Сон, Пт, 13 нояб. 23:00 → сб, 14 нояб. 07:00');
      expect(box.eventId).toBe('n1');
    }
    expect([friday.key, saturday.key]).toEqual(['n1@2026-11-13', 'n1@2026-11-14']);
    expect(toBox(seg(ev('2026-11-09T22:00', '2026-11-10T00:00', [A]))).timeLabel).toBe(
      '22:00–00:00',
    );
  });

  it('colors from the palette by the resolved color; flags passed through', () => {
    const box = toBox(
      seg(ev('2026-11-09T09:00', '2026-11-09T10:00', [A], { color: 'TRIP', fromTemplate: true })),
    );
    expect(box.colors).toBe(CATEGORY_PALETTE.TRIP);
    expect([box.joint, box.fromTemplate, box.title]).toEqual([false, true, expect.any(String)]);
  });

  it('another scale (px per minute) moves and sizes the card by it', () => {
    const box = toBox(seg(ev('2026-11-09T09:00', '2026-11-09T10:00', [A])), 1);
    expect([box.top, box.height]).toEqual([541, 58]);
  });
});
