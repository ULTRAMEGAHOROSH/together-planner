import { resolveAddress, shiftDay, weekUrl } from './week-address';

const CURRENT = '2026-11-09';

describe('week address (WEEK-13)', () => {
  it('weekUrl: the week, and the day when there is one', () => {
    expect(weekUrl({ weekStart: '2026-11-09', day: null })).toBe('/week/2026-11-09');
    expect(weekUrl({ weekStart: '2026-11-09', day: '2026-11-12' })).toBe(
      '/week/2026-11-09?day=2026-11-12',
    );
  });

  it('a Monday, with or without a day of that week, is canonical', () => {
    expect(resolveAddress('2026-11-16', undefined, CURRENT)).toEqual({
      address: { weekStart: '2026-11-16', day: null },
      canonical: true,
    });
    expect(resolveAddress('2026-11-16', '2026-11-22', CURRENT)).toEqual({
      address: { weekStart: '2026-11-16', day: '2026-11-22' },
      canonical: true,
    });
  });

  it('another day of the week → its Monday; a day of that week is kept', () => {
    expect(resolveAddress('2026-11-18', undefined, CURRENT)).toEqual({
      address: { weekStart: '2026-11-16', day: null },
      canonical: false,
    });
    expect(resolveAddress('2026-11-18', '2026-11-20', CURRENT).address).toEqual({
      weekStart: '2026-11-16',
      day: '2026-11-20',
    });
  });

  it.each([
    ['a day of another week', '2026-11-23'],
    ['the day before the week', '2026-11-15'],
    ['not a date', 'tomorrow'],
    ['empty', ''],
    ['an impossible date', '2026-02-30'],
  ])('%s → no day, the address is replaced', (_, day) => {
    expect(resolveAddress('2026-11-16', day, CURRENT)).toEqual({
      address: { weekStart: '2026-11-16', day: null },
      canonical: false,
    });
  });

  it('not a date → the current week', () => {
    expect(resolveAddress('next-week', undefined, CURRENT)).toEqual({
      address: { weekStart: CURRENT, day: null },
      canonical: false,
    });
  });

  it('shiftDay crosses the border of the week both ways', () => {
    expect(shiftDay('2026-11-15', 1)).toEqual({ weekStart: '2026-11-16', day: '2026-11-16' });
    expect(shiftDay('2026-11-16', -1)).toEqual({ weekStart: '2026-11-09', day: '2026-11-15' });
    expect(shiftDay('2026-11-12', 1)).toEqual({ weekStart: '2026-11-09', day: '2026-11-13' });
  });
});
