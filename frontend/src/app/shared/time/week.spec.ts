import { addDays, daysBetween, isMonday, isoDayOfWeek, weekDays, weekStartOf } from './week';

describe('week helpers (spec §3, rule 5)', () => {
  it('DT-03: weekStartOf → Monday of the same week (Mon, Thu, Sun)', () => {
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-12')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09');
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28'); // across the year
  });

  it('DT-04: addDays across the year boundary', () => {
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2027-01-04', -7)).toBe('2026-12-28');
    expect(addDays('2026-11-20', 0)).toBe('2026-11-20');
  });

  it('DT-05: addDays across the end of February', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(() => addDays('2026-11-20', 0.5)).toThrow(RangeError);
  });

  it('DT-06: isoDayOfWeek is 1 (Monday) … 7 (Sunday)', () => {
    expect(isoDayOfWeek('2026-11-15')).toBe(7);
    expect(isoDayOfWeek('2026-11-16')).toBe(1);
    expect(isoDayOfWeek('1970-01-01')).toBe(4);
    expect(isoDayOfWeek('1969-12-29')).toBe(1); // before day 0
    const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
    expect([...week, '2026-11-14', '2026-11-15'].map(isoDayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('DT-10: weekDays(Monday) → Monday…Sunday, also across months', () => {
    expect(weekDays('2026-11-30')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ]);
    expect(() => weekDays('2026-12-01')).toThrow('Week must start on Monday: "2026-12-01"');
  });

  it('isMonday', () => {
    expect(isMonday('2026-11-23')).toBe(true);
    expect(isMonday('2026-11-29')).toBe(false);
    expect(() => isMonday('2026-11-31')).toThrow(RangeError);
  });

  it('daysBetween counts whole days, negative backwards', () => {
    expect(daysBetween('2026-11-23', '2026-11-29')).toBe(6);
    expect(daysBetween('2026-11-29', '2026-11-23')).toBe(-6);
    expect(daysBetween('2026-12-28', '2027-01-04')).toBe(7);
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29);
  });
});
