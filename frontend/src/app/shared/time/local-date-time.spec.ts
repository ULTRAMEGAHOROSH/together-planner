import {
  compareLocal,
  DAY_MINUTES,
  dateOfMinutes,
  formatDate,
  formatLocalDateTime,
  formatTime,
  fromLocalMinutes,
  minutesOfDay,
  parseDate,
  parseLocalDateTime,
  parseTime,
  toLocalMinutes,
} from './local-date-time';

describe('local date-time (FD-30…32)', () => {
  it('DT-01: with and without seconds / fraction → the same local minutes', () => {
    const expected = parseLocalDateTime('2026-11-20T08:00');
    expect(parseLocalDateTime('2026-11-20T08:00:00')).toBe(expected);
    expect(parseLocalDateTime('2026-11-20T08:00:00.000')).toBe(expected);
    expect(parseLocalDateTime('2026-11-20T08:00:00.123456789')).toBe(expected);
    expect(expected).toBe(Date.UTC(2026, 10, 20, 8, 0) / 60_000); // the FD-30 scale
  });

  it('DT-02: always formats as YYYY-MM-DDTHH:mm', () => {
    expect(formatLocalDateTime(parseLocalDateTime('2026-11-20T08:00:00.000'))).toBe(
      '2026-11-20T08:00',
    );
    expect(formatLocalDateTime(parseLocalDateTime('2027-01-01T00:05:59'))).toBe('2027-01-01T00:05');
  });

  it('DT-07: a day is always 1440 minutes, even on a DST change day in Europe', () => {
    expect(parseLocalDateTime('2026-03-30T00:00') - parseLocalDateTime('2026-03-29T00:00')).toBe(
      DAY_MINUTES,
    );
    expect(parseLocalDateTime('2026-10-26T00:00') - parseLocalDateTime('2026-10-25T00:00')).toBe(
      DAY_MINUTES,
    );
    // 02:30 does not exist in Berlin on 2026-03-29, but it is a valid wall-clock value here.
    expect(formatLocalDateTime(parseLocalDateTime('2026-03-29T02:30'))).toBe('2026-03-29T02:30');
  });

  it('DT-08: impossible or malformed values throw instead of becoming a "quiet" date', () => {
    for (const value of [
      '2026-13-01T00:00',
      '2026-02-29T00:00',
      '2026-04-31T10:00',
      '2026-11-20T24:00',
      '2026-11-20T08:60',
      '2026-11-20T08:00:60',
      '2026-11-20 08:00',
      '2026-11-20T8:00',
      '2026-11-20T08:00Z',
      '2026-11-20T08:00+05:00',
      '2026-11-20T',
      '2026-11-20',
      '2026-11-20T08:00T09:00',
      '0099-01-01T00:00',
      'abc',
      '',
    ]) {
      expect(() => parseLocalDateTime(value), value).toThrow(RangeError);
    }
    expect(() => parseLocalDateTime('abc')).toThrow('Invalid local date-time: "abc"');
  });

  it('leap years: 29 February only when it exists', () => {
    expect(formatLocalDateTime(parseLocalDateTime('2028-02-29T12:00'))).toBe('2028-02-29T12:00');
    expect(formatLocalDateTime(parseLocalDateTime('2000-02-29T12:00'))).toBe('2000-02-29T12:00');
    expect(() => parseLocalDateTime('2100-02-29T12:00')).toThrow(RangeError);
  });

  it('DT-09: parseTime accepts HH:mm and HH:mm:ss', () => {
    expect(parseTime('08:00:00')).toBe(480);
    expect(parseTime('23:30')).toBe(1410);
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('23:59:59.999')).toBe(1439);
    for (const value of ['24:00', '12:60', '12:00:60', '8:00', '12', '12:00:00:00', '']) {
      expect(() => parseTime(value), value).toThrow(RangeError);
    }
  });

  it('formatTime: minutes since midnight → HH:mm (0–1439 only)', () => {
    expect([0, 59, 480, 1410, 1439].map(formatTime)).toEqual([
      '00:00',
      '00:59',
      '08:00',
      '23:30',
      '23:59',
    ]);
    for (const value of [-1, 1440, 1.5, Number.NaN]) {
      expect(() => formatTime(value), String(value)).toThrow(RangeError);
    }
  });

  it('parseDate / formatDate: midnight of the date and back', () => {
    const midnight = parseDate('2026-11-20');
    expect(midnight).toBe(parseLocalDateTime('2026-11-20T00:00'));
    expect(formatDate(midnight)).toBe('2026-11-20');
    expect(formatDate(midnight + DAY_MINUTES - 1)).toBe('2026-11-20');
    expect(formatDate(midnight + DAY_MINUTES)).toBe('2026-11-21');
    for (const value of ['2026-11-31', '2026-1-01', '20261120', '2026-11-20T00:00']) {
      expect(() => parseDate(value), value).toThrow(RangeError);
    }
  });

  it('toLocalMinutes / fromLocalMinutes are inverse; invalid parts throw', () => {
    const parts = { year: 2026, month: 11, day: 20, hour: 23, minute: 30 };
    expect(fromLocalMinutes(toLocalMinutes(parts))).toEqual(parts);
    expect(toLocalMinutes({ year: 1970, month: 1, day: 1, hour: 0, minute: 0 })).toBe(0);
    expect(fromLocalMinutes(-1)).toEqual({ year: 1969, month: 12, day: 31, hour: 23, minute: 59 });
    for (const bad of [
      { ...parts, month: 0 },
      { ...parts, month: 13 },
      { ...parts, day: 0 },
      { ...parts, day: 31, month: 11 },
      { ...parts, hour: -1 },
      { ...parts, minute: 60 },
      { ...parts, minute: 1.5 },
      { ...parts, year: 99 },
      { ...parts, year: 10_000 },
    ]) {
      expect(() => toLocalMinutes(bad), JSON.stringify(bad)).toThrow(RangeError);
    }
    expect(() => fromLocalMinutes(1.5)).toThrow(RangeError);
    expect(() => fromLocalMinutes(Number.NaN)).toThrow(RangeError);
  });

  it('minutesOfDay / dateOfMinutes split a minute into day start and position', () => {
    const m = parseLocalDateTime('2026-11-20T23:30');
    expect(minutesOfDay(m)).toBe(1410);
    expect(dateOfMinutes(m)).toBe(parseDate('2026-11-20'));
    expect(minutesOfDay(parseDate('2026-11-21'))).toBe(0);
    expect(minutesOfDay(-1)).toBe(1439); // before 1970 still works
    expect(dateOfMinutes(-1)).toBe(-DAY_MINUTES);
    expect(() => minutesOfDay(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('compareLocal orders strings by time regardless of their format', () => {
    const values = ['2026-11-20T10:00', '2026-11-20T08:00:00', '2026-11-19T23:59:59.5'];
    expect([...values].sort(compareLocal)).toEqual([
      '2026-11-19T23:59:59.5',
      '2026-11-20T08:00:00',
      '2026-11-20T10:00',
    ]);
    expect(compareLocal('2026-11-20T08:00', '2026-11-20T08:00:00')).toBe(0);
  });

  it('does not depend on the browser time zone', () => {
    // Same input → same output whatever TZ the test machine has: no local getters are used.
    expect(parseLocalDateTime('2026-11-20T00:00') % DAY_MINUTES).toBe(0);
    expect(formatLocalDateTime(0)).toBe('1970-01-01T00:00');
  });
});
