// Russian date labels, ported from the prototype (design/Main.dc.html). Own word lists
// instead of Intl: Intl output for "ru" differs between engines ("нояб." / "ноя"),
// and the UI and tests need stable text (frontend-final-decisions.md, §8 table).
import type { IsoDate } from '@core/api/models/common.models';
import {
  dateOfMinutes,
  formatDate,
  formatTime,
  fromLocalMinutes,
  minutesOfDay,
  parseDate,
  parseLocalDateTime,
} from './local-date-time';
import { plural } from './plural';
import { addDays, isMonday, isoDayOfWeek } from './week';

/** Months in the genitive case: «9 ноября». */
export const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** Months as a title: «Ноябрь 2026». */
export const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

/** Short months after a day number: «9 нояб.», «9 мая». */
export const MONTHS_SHORT = [
  'янв.',
  'февр.',
  'марта',
  'апр.',
  'мая',
  'июня',
  'июля',
  'авг.',
  'сент.',
  'окт.',
  'нояб.',
  'дек.',
] as const;

/** Day headers, Monday first (index = ISO day − 1): «Пн». */
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

/** Full day names, Monday first: «понедельник». */
export const WEEKDAYS_LONG = [
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
  'воскресенье',
] as const;

const WEEKDAYS_LOWER = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

interface DayParts {
  day: number;
  /** 0 = January. */
  month: number;
  year: number;
  /** 0 = Monday. */
  weekday: number;
}

function partsOf(date: IsoDate): DayParts {
  const { year, month, day } = fromLocalMinutes(parseDate(date));
  return { day, month: month - 1, year, weekday: isoDayOfWeek(date) - 1 };
}

function weekBounds(weekStart: IsoDate): [DayParts, DayParts] {
  if (!isMonday(weekStart)) {
    throw new RangeError(`Week must start on Monday: ${JSON.stringify(weekStart)}`);
  }
  return [partsOf(weekStart), partsOf(addDays(weekStart, 6))];
}

/** First letter in upper case: «пт, 13 нояб.» → «Пт, 13 нояб.». */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * «9 – 15 ноября 2026», «30 ноября – 6 декабря 2026». The year is the year of Sunday,
 * as in the prototype: «28 декабря – 3 января 2027».
 */
export function weekLabel(weekStart: IsoDate): string {
  const [from, to] = weekBounds(weekStart);
  const tail = `${to.day} ${MONTHS_GENITIVE[to.month]} ${to.year}`;
  return from.month === to.month
    ? `${from.day} – ${tail}`
    : `${from.day} ${MONTHS_GENITIVE[from.month]} – ${tail}`;
}

/** «9–15 нояб.», «30 нояб. – 6 дек.». */
export function weekShort(weekStart: IsoDate): string {
  const [from, to] = weekBounds(weekStart);
  const tail = `${to.day} ${MONTHS_SHORT[to.month]}`;
  return from.month === to.month
    ? `${from.day}–${tail}`
    : `${from.day} ${MONTHS_SHORT[from.month]} – ${tail}`;
}

/** «Ноябрь 2026» (month view title). */
export function monthTitle(date: IsoDate): string {
  const { month, year } = partsOf(date);
  return `${MONTHS_NOMINATIVE[month]} ${year}`;
}

/** «понедельник, 9 ноября». */
export function dateLong(date: IsoDate): string {
  const { day, month, weekday } = partsOf(date);
  return `${WEEKDAYS_LONG[weekday]}, ${day} ${MONTHS_GENITIVE[month]}`;
}

/** «пн, 9 нояб.». */
export function dateShort(date: IsoDate): string {
  const { day, month, weekday } = partsOf(date);
  return `${WEEKDAYS_LOWER[weekday]}, ${day} ${MONTHS_SHORT[month]}`;
}

/**
 * Event time range. Same day: «Пн, 9 нояб. · 09:00–18:00».
 * Different days: «Пт, 13 нояб. 23:00 → сб, 14 нояб. 07:00».
 * Accepts backend date-times with or without seconds.
 */
export function rangeText(start: string, end: string): string {
  const from = parseLocalDateTime(start);
  const to = parseLocalDateTime(end);
  const fromDate = formatDate(dateOfMinutes(from));
  const toDate = formatDate(dateOfMinutes(to));
  const fromTime = formatTime(minutesOfDay(from));
  const toTime = formatTime(minutesOfDay(to));
  if (fromDate === toDate) {
    return `${capitalize(dateShort(fromDate))} · ${fromTime}–${toTime}`;
  }
  return `${capitalize(dateShort(fromDate))} ${fromTime} → ${dateShort(toDate)} ${toTime}`;
}

/** Duration: «1 ч 30 мин», «1 ч», «45 мин», «0 мин». */
export function durText(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError(`Invalid duration: ${minutes}`);
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours) {
    parts.push(`${hours} ч`);
  }
  if (rest) {
    parts.push(`${rest} мин`);
  }
  return parts.length ? parts.join(' ') : '0 мин';
}

/**
 * Week relative to the current one (`offset` in weeks): «Эта неделя», «Следующая неделя»,
 * «Прошлая неделя», «Через 2 недели», «3 недели назад».
 */
export function relWeek(offset: number): string {
  if (!Number.isInteger(offset)) {
    throw new RangeError(`Invalid week offset: ${offset}`);
  }
  if (offset === 0) {
    return 'Эта неделя';
  }
  if (offset === 1) {
    return 'Следующая неделя';
  }
  if (offset === -1) {
    return 'Прошлая неделя';
  }
  const n = Math.abs(offset);
  const weeks = `${n} ${plural(n, 'неделю', 'недели', 'недель')}`;
  return offset > 0 ? `Через ${weeks}` : `${weeks} назад`;
}

/**
 * Days until an upcoming event: «сегодня», «завтра», «через 5 дней».
 * Zero or less is «сегодня»: the event has already started (prototype rule).
 */
export function relDays(days: number): string {
  if (!Number.isInteger(days)) {
    throw new RangeError(`Invalid day count: ${days}`);
  }
  if (days <= 0) {
    return 'сегодня';
  }
  if (days === 1) {
    return 'завтра';
  }
  return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
}
