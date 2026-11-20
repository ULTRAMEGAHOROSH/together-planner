import {
  MONTHS_GENITIVE,
  MONTHS_NOMINATIVE,
  MONTHS_SHORT,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  capitalize,
  dateLong,
  dateShort,
  dayMonthTime,
  dayMonthYear,
  durText,
  monthTitle,
  rangeText,
  relDays,
  relWeek,
  weekLabel,
  weekShort,
} from './format-ru';
import { parseLocalDateTime } from './local-date-time';
import { addDays } from './week';

// Expected strings are the prototype's output (design/Main.dc.html).
describe('format-ru: weeks', () => {
  it('FR-01: weekLabel inside one month', () => {
    expect(weekLabel('2026-11-09')).toBe('9 – 15 ноября 2026');
  });

  it('FR-02: weekLabel across two months', () => {
    expect(weekLabel('2026-11-30')).toBe('30 ноября – 6 декабря 2026');
  });

  it('weekLabel across New Year shows both years', () => {
    expect(weekLabel('2026-12-28')).toBe('28 декабря 2026 – 3 января 2027');
    expect(weekLabel('2027-12-27')).toBe('27 декабря 2027 – 2 января 2028');
    // A week ending on 31 December stays inside one year.
    expect(weekLabel('2028-12-25')).toBe('25 – 31 декабря 2028');
  });

  it('FR-03: weekShort inside one month and across months', () => {
    expect(weekShort('2026-11-16')).toBe('16–22 нояб.');
    expect(weekShort('2026-11-30')).toBe('30 нояб. – 6 дек.');
    expect(weekShort('2026-04-27')).toBe('27 апр. – 3 мая');
  });

  it('week labels require a Monday', () => {
    expect(() => weekLabel('2026-11-10')).toThrow(RangeError);
    expect(() => weekShort('2026-11-15')).toThrow(RangeError);
  });

  it('monthTitle', () => {
    expect(monthTitle('2026-11-18')).toBe('Ноябрь 2026');
    expect(monthTitle('2027-01-01')).toBe('Январь 2027');
  });
});

describe('format-ru: days', () => {
  it('dateLong and dateShort', () => {
    expect(dateLong('2026-11-09')).toBe('понедельник, 9 ноября');
    expect(dateShort('2026-11-09')).toBe('пн, 9 нояб.');
    expect(dateLong('2026-11-15')).toBe('воскресенье, 15 ноября');
    expect(dateShort('2026-05-09')).toBe('сб, 9 мая');
  });

  it('every month and weekday has its own word', () => {
    expect(new Set(MONTHS_GENITIVE).size).toBe(12);
    expect(new Set(MONTHS_NOMINATIVE).size).toBe(12);
    expect(new Set(MONTHS_SHORT).size).toBe(12);
    expect(WEEKDAYS_SHORT).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    expect(WEEKDAYS_LONG[6]).toBe('воскресенье');
    // 2026-01-05 is a Monday: walk one week and the 12 months.
    const days = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    days.forEach((d, i) => expect(dateShort(addDays('2026-01-05', i))).toBe(`${d}, ${5 + i} янв.`));
    MONTHS_GENITIVE.forEach((m, i) => {
      const month = String(i + 1).padStart(2, '0');
      expect(dateLong(`2026-${month}-01`)).toMatch(new RegExp(`, 1 ${m}$`));
      expect(dateShort(`2026-${month}-01`)).toMatch(new RegExp(`, 1 ${MONTHS_SHORT[i]}$`));
    });
  });

  it('dayMonthYear: «24 ноября 2026», the first and the last day of a year', () => {
    expect(dayMonthYear(parseLocalDateTime('2026-11-24T16:06'))).toBe('24 ноября 2026');
    expect(dayMonthYear(parseLocalDateTime('2027-01-01T00:00'))).toBe('1 января 2027');
    expect(dayMonthYear(parseLocalDateTime('2026-12-31T23:59'))).toBe('31 декабря 2026');
  });

  it('dayMonthTime: «24 ноября, 16:06»', () => {
    expect(dayMonthTime(parseLocalDateTime('2026-11-24T16:06'))).toBe('24 ноября, 16:06');
    expect(dayMonthTime(parseLocalDateTime('2027-01-01T00:00'))).toBe('1 января, 00:00');
  });

  it('capitalize', () => {
    expect(capitalize('пт, 13 нояб.')).toBe('Пт, 13 нояб.');
    expect(capitalize('')).toBe('');
  });

  it('invalid dates throw', () => {
    expect(() => dateLong('2026-02-30')).toThrow(RangeError);
    expect(() => dateShort('9 ноября')).toThrow(RangeError);
  });
});

describe('format-ru: event range and duration', () => {
  it('FR-04: rangeText across days uses «→»', () => {
    expect(rangeText('2026-11-13T23:00', '2026-11-14T07:00')).toBe(
      'Пт, 13 нояб. 23:00 → сб, 14 нояб. 07:00',
    );
  });

  it('rangeText inside one day', () => {
    expect(rangeText('2026-11-09T09:00', '2026-11-09T18:00')).toBe('Пн, 9 нояб. · 09:00–18:00');
  });

  it('rangeText accepts backend seconds and drops them', () => {
    expect(rangeText('2026-11-13T23:00:00', '2026-11-14T07:30:00.000000')).toBe(
      'Пт, 13 нояб. 23:00 → сб, 14 нояб. 07:30',
    );
    expect(() => rangeText('2026-11-13', '2026-11-14T07:00')).toThrow(RangeError);
  });

  it('FR-05: durText', () => {
    expect(durText(90)).toBe('1 ч 30 мин');
    expect(durText(60)).toBe('1 ч');
    expect(durText(0)).toBe('0 мин');
    expect(durText(45)).toBe('45 мин');
    expect(durText(1440)).toBe('24 ч');
    expect(durText(1441)).toBe('24 ч 1 мин');
  });

  it('durText rejects negative and fractional minutes', () => {
    expect(() => durText(-1)).toThrow(RangeError);
    expect(() => durText(1.5)).toThrow(RangeError);
  });
});

describe('format-ru: relative labels', () => {
  it('relWeek', () => {
    expect(relWeek(0)).toBe('Эта неделя');
    expect(relWeek(1)).toBe('Следующая неделя');
    expect(relWeek(-1)).toBe('Прошлая неделя');
    expect(relWeek(2)).toBe('Через 2 недели');
    expect(relWeek(5)).toBe('Через 5 недель');
    expect(relWeek(21)).toBe('Через 21 неделю');
    expect(relWeek(-3)).toBe('3 недели назад');
    expect(relWeek(-11)).toBe('11 недель назад');
    expect(() => relWeek(0.5)).toThrow(RangeError);
  });

  it('relDays (already started counts as today)', () => {
    expect(relDays(0)).toBe('сегодня');
    expect(relDays(-2)).toBe('сегодня');
    expect(relDays(1)).toBe('завтра');
    expect(relDays(2)).toBe('через 2 дня');
    expect(relDays(5)).toBe('через 5 дней');
    expect(relDays(21)).toBe('через 21 день');
    expect(() => relDays(Number.NaN)).toThrow(RangeError);
  });
});
