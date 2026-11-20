import { describe, expect, it } from 'vitest';
import {
  calendarUrl,
  firstOfMonth,
  isMonth,
  monthGrid,
  monthLabel,
  monthOf,
  resolveMonth,
  shiftMonth,
} from './month';

describe('month address', () => {
  it('knows a month from a string', () => {
    expect(isMonth('2026-11')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('2026-00')).toBe(false);
    expect(isMonth('2026-1')).toBe(false);
    expect(isMonth('2026-11-01')).toBe(false);
    expect(isMonth('1999-12')).toBe(false);
    expect(isMonth('2101-01')).toBe(false);
  });

  it('gives the month of a date and its first day', () => {
    expect(monthOf('2026-11-20')).toBe('2026-11');
    expect(firstOfMonth('2026-11')).toBe('2026-11-01');
  });

  it('shifts across the border of a year', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-11', -11)).toBe('2025-12');
    expect(shiftMonth('2026-11', 0)).toBe('2026-11');
  });

  it('writes the title and the url', () => {
    expect(monthLabel('2026-11')).toBe('Ноябрь 2026');
    expect(calendarUrl('2026-11')).toBe('/calendar?month=2026-11');
  });

  it('keeps a month and puts anything else right', () => {
    expect(resolveMonth('2026-05', '2026-11')).toEqual({ month: '2026-05', canonical: true });
    expect(resolveMonth(undefined, '2026-11')).toEqual({ month: '2026-11', canonical: false });
    expect(resolveMonth('soon', '2026-11')).toEqual({ month: '2026-11', canonical: false });
  });
});

describe('monthGrid', () => {
  it('November 2026 starts on Monday 26.10 and needs six weeks (30.11 is a Monday)', () => {
    const { days } = monthGrid('2026-11');
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-10-26');
    expect(days[41]).toBe('2026-12-06');
    expect(days).toContain('2026-11-30');
  });

  it('December 2026 fits five weeks: from 30.11 to 03.01', () => {
    const { days } = monthGrid('2026-12');
    expect(days).toHaveLength(35);
    expect(days[0]).toBe('2026-11-30');
    expect(days[34]).toBe('2027-01-03');
  });

  it('February 2027 starts on its own Monday and fits four weeks plus one', () => {
    const { days } = monthGrid('2027-02');
    expect(days[0]).toBe('2027-02-01');
    expect(days).toHaveLength(35);
    expect(days[34]).toBe('2027-03-07');
  });

  it('is whole weeks and its request range stays within the 93 days of E1', () => {
    for (let i = 0; i < 24; i++) {
      const { days } = monthGrid(shiftMonth('2026-01', i));
      expect(days.length % 7).toBe(0);
      expect(days.length).toBeLessThanOrEqual(93);
    }
  });

  it('every day of the month is in the grid', () => {
    for (let i = 0; i < 24; i++) {
      const month = shiftMonth('2026-01', i);
      const inMonth = monthGrid(month).days.filter((d) => monthOf(d) === month);
      expect(inMonth.length).toBeGreaterThanOrEqual(28);
      expect(inMonth[0]).toBe(firstOfMonth(month));
    }
  });
});
