import { parseLocalDateTime } from '@shared/time/local-date-time';
import { nowMark, sameNowMark } from './now-mark';

const at = (value: string) => nowMark(parseLocalDateTime(value));

describe('nowMark (WEEK-07)', () => {
  it('14:20 on Fri 6 Nov → 573 px (860 min × ⅔), the label «14:20»', () => {
    expect(at('2026-11-06T14:20')).toEqual({ date: '2026-11-06', top: 573, label: '14:20' });
  });

  it('the edges of the day: 00:00 is the top, 23:59 stays inside the 960 px', () => {
    expect(at('2026-11-07T00:00')).toEqual({ date: '2026-11-07', top: 0, label: '00:00' });
    expect(at('2026-11-06T23:59')).toEqual({ date: '2026-11-06', top: 959, label: '23:59' });
  });

  it('another scale (px per minute)', () => {
    expect(nowMark(parseLocalDateTime('2026-11-06T01:30'), 1).top).toBe(90);
  });

  it('sameNowMark: equal marks are one value; a minute later or another day is not', () => {
    const mark = at('2026-11-06T14:20');
    expect(sameNowMark(mark, at('2026-11-06T14:20'))).toBe(true);
    expect(sameNowMark(mark, mark)).toBe(true);
    expect(sameNowMark(mark, at('2026-11-06T14:21'))).toBe(false); // top and label
    expect(sameNowMark(mark, at('2026-11-07T14:20'))).toBe(false); // date only
    expect(sameNowMark(mark, null)).toBe(false);
    expect(sameNowMark(null, mark)).toBe(false);
    expect(sameNowMark(null, null)).toBe(true);
    // Two minutes can share a pixel; the label still tells them apart.
    expect(at('2026-11-06T14:20').top).toBe(at('2026-11-06T14:21').top - 1);
    expect(sameNowMark({ ...mark, label: '14:21' }, mark)).toBe(false);
  });
});
