// Board fixtures for the dev playground (/_dev/board) and component tests: a week of the
// pair in the spirit of the prototype (design/Main.dc.html, «Обычная неделя» and seed).
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import type { EventCategory } from '@core/api/models/enums';
import type { Seat } from '@core/api/models/workspace.models';
import { parseLocalDateTime } from '@shared/time/local-date-time';
import { addDays } from '@shared/time/week';
import type { TimelineEvent } from '../engine/model';
import { A, B } from './event-builder';

/** Week W of the engine tests (§8.4): Monday 9 — Sunday 15 November 2026. */
export const FIXTURE_WEEK: IsoDate = '2026-11-09';
/** «Today» of the fixtures: Thursday. */
export const FIXTURE_TODAY: IsoDate = '2026-11-12';

/** Time zone of the fixture workspace, as in the CLOCK of CORE-06 tests. */
export const FIXTURE_ZONE = 'Asia/Almaty';
/** «Now» of the fixtures: Thursday 12.11 14:20 in `FIXTURE_ZONE` (09:20 UTC). */
export const FIXTURE_NOW = Date.UTC(2026, 10, 12, 9, 20);
/** A frozen `CLOCK` at `FIXTURE_NOW`. */
export function fixtureClock(): number {
  return FIXTURE_NOW;
}

export interface FixtureMember {
  readonly id: Uuid;
  readonly name: string;
  readonly seat: Seat;
}

/** The pair, names as in the prototype. */
export const FIXTURE_MEMBERS: readonly FixtureMember[] = [
  { id: A, name: 'Daulet', seat: 1 },
  { id: B, name: 'Партнёр', seat: 2 },
];

export interface BoardScenario {
  readonly id: string;
  readonly label: string;
  readonly events: readonly TimelineEvent[];
}

type Who = readonly Uuid[];

/** Builds the events of one scenario with stable ids `<prefix>-1`, `<prefix>-2`, … */
function scenario(prefix: string) {
  let n = 0;
  const make = (
    title: string,
    startMin: number,
    endMin: number,
    who: Who,
    category: EventCategory,
  ): TimelineEvent => ({
    id: `${prefix}-${++n}`,
    title,
    startMin,
    endMin,
    participantIds: who,
    category,
    color: category,
    joint: who.length > 1,
    fromTemplate: false,
  });
  /** An event between two local date-times. */
  const event = (title: string, start: string, end: string, who: Who, category: EventCategory) =>
    make(title, parseLocalDateTime(start), parseLocalDateTime(end), who, category);
  /** An event on day 1–7 of the fixture week, from «HH:mm», lasting `minutes`. */
  const at = (
    day: number,
    title: string,
    start: string,
    minutes: number,
    who: Who,
    category: EventCategory,
  ) => {
    const startMin = parseLocalDateTime(`${addDays(FIXTURE_WEEK, day - 1)}T${start}`);
    return make(title, startMin, startMin + minutes, who, category);
  };
  return { event, at };
}

const both: Who = [A, B];

function usualWeek(): TimelineEvent[] {
  const { at } = scenario('usual');
  const events: TimelineEvent[] = [];
  for (let d = 1; d <= 5; d++) {
    events.push(
      at(d, 'Дорога', '08:15', 45, [A], 'COMMUTE'),
      at(d, 'Работа', '09:00', 240, [A], 'WORK'),
      at(d, 'Обед', '13:00', 60, [A], 'FOOD'),
      at(d, 'Работа', '14:00', 240, [A], 'WORK'),
      at(d, 'Завтрак', '07:30', 45, [B], 'FOOD'),
      at(d, 'Дорога', '08:30', 60, [B], 'COMMUTE'),
      at(d, 'Работа', '09:30', 210, [B], 'WORK'),
      at(d, 'Обед', '13:00', 60, [B], 'FOOD'),
      at(d, 'Работа', '14:00', 270, [B], 'WORK'),
    );
  }
  events.push(
    at(1, 'Спортзал', '18:30', 90, [A], 'SPORT'),
    at(3, 'Спортзал', '18:30', 90, [A], 'SPORT'),
    at(2, 'Йога', '19:00', 60, [B], 'SPORT'),
    at(4, 'Йога', '19:00', 60, [B], 'SPORT'),
  );
  for (let d = 1; d <= 4; d++)
    events.push(at(d, 'Ужин и вечер вместе', '20:15', 105, both, 'TOGETHER'));
  events.push(
    at(5, 'Свидание', '19:30', 180, both, 'TOGETHER'),
    at(6, 'Завтрак', '10:00', 60, both, 'FOOD'),
    at(6, 'Покупки', '11:30', 120, both, 'OTHER'),
    at(6, 'Встреча с подругами', '15:00', 150, [B], 'REST'),
    at(6, 'Футбол', '16:00', 120, [A], 'SPORT'),
    at(6, 'Кино', '19:30', 150, both, 'REST'),
    at(7, 'Поздний завтрак', '11:00', 60, both, 'FOOD'),
    at(7, 'Прогулка', '13:00', 120, both, 'REST'),
    at(7, 'Чтение', '16:00', 90, [B], 'REST'),
    at(7, 'Планируем неделю', '20:00', 30, both, 'TOGETHER'),
  );
  for (let d = 1; d <= 7; d++) {
    events.push(at(d, 'Сон', '23:30', 450, [A], 'SLEEP'), at(d, 'Сон', '23:00', 450, [B], 'SLEEP'));
  }
  return events;
}

function nightSleep(): TimelineEvent[] {
  const { event, at } = scenario('night');
  const events = [
    // From Sunday of the previous week: only the morning part is in this week.
    event('Сон', '2026-11-08T23:30', '2026-11-09T07:00', [A], 'SLEEP'),
    event('Сон', '2026-11-08T23:00', '2026-11-09T06:30', [B], 'SLEEP'),
    // Overlaps the end of the night: two lanes in the morning.
    at(1, 'Пробежка', '06:30', 60, [A], 'SPORT'),
    at(3, 'Ранний рейс', '05:00', 180, [B], 'TRIP'),
  ];
  for (let d = 1; d <= 7; d++) {
    events.push(at(d, 'Сон', '23:30', 450, [A], 'SLEEP'), at(d, 'Сон', '23:00', 450, [B], 'SLEEP'));
  }
  return events;
}

function overlaps(): TimelineEvent[] {
  const { at } = scenario('overlaps');
  return [
    // Tuesday of A: a 3-lane cluster, then touching events, then the same start.
    at(2, 'Работа', '09:00', 240, [A], 'WORK'),
    at(2, 'Созвон с командой', '11:00', 60, both, 'WORK'),
    at(2, 'Кофе', '11:00', 15, [A], 'FOOD'),
    at(2, 'Обед', '14:00', 60, [A], 'FOOD'),
    at(2, 'Прогулка', '15:00', 60, [A], 'REST'),
    at(2, 'Спортзал', '16:00', 180, [A], 'SPORT'),
    at(2, 'Звонок маме', '16:00', 60, [A], 'OTHER'),
    // Thursday: three at once in both panels.
    at(4, 'Встреча', '09:00', 60, both, 'WORK'),
    at(4, 'Стоматолог', '09:00', 60, [B], 'OTHER'),
    at(4, 'Доставка', '09:00', 60, [A], 'OTHER'),
    at(4, 'Звонок', '09:00', 60, [B], 'OTHER'),
    // Wednesday of B: every card density (5, 15, 30, 45, 60, 120 minutes).
    at(3, 'Таблетка', '08:00', 5, [B], 'OTHER'),
    at(3, 'Кофе', '09:00', 15, [B], 'FOOD'),
    at(3, 'Созвон', '10:00', 30, [B], 'WORK'),
    at(3, 'Почта', '11:00', 45, [B], 'WORK'),
    at(3, 'Ланч', '12:00', 60, [B], 'FOOD'),
    at(3, 'Ремонт', '14:00', 120, [B], 'OTHER'),
  ];
}

function trip(): TimelineEvent[] {
  const { event, at } = scenario('trip');
  const events = [
    event('Поездка в горы', '2026-11-13T08:00', '2026-11-15T20:00', both, 'TRIP'),
    event('Командировка', '2026-11-10T18:00', '2026-11-11T21:00', [B], 'TRIP'),
    at(5, 'Сборы', '06:30', 60, both, 'OTHER'),
  ];
  for (let d = 1; d <= 4; d++) events.push(at(d, 'Работа', '09:00', 480, [A], 'WORK'));
  return events;
}

function weekEdges(): TimelineEvent[] {
  const { event } = scenario('edge');
  return [
    // Into the next week (like E3 «Поезд»): only Sunday evening is shown.
    event('Поезд', '2026-11-15T22:00', '2026-11-16T06:00', [A], 'TRIP'),
    // From the previous week: only Monday morning.
    event('Ночная смена', '2026-11-08T20:00', '2026-11-09T08:00', [B], 'WORK'),
    // Ends exactly at midnight / starts exactly at midnight: no piece in the other day.
    event('Вечеринка', '2026-11-10T22:00', '2026-11-11T00:00', [A], 'REST'),
    event('Ночной фильм', '2026-11-11T00:00', '2026-11-11T02:00', [A], 'REST'),
    // Longer than the week: whole columns.
    event('Командировка', '2026-11-12T09:00', '2026-11-20T18:00', [B], 'TRIP'),
  ];
}

/** Scenarios of the playground, in the order of its switcher. */
export const BOARD_SCENARIOS: readonly BoardScenario[] = [
  { id: 'usual', label: 'Обычная неделя', events: usualWeek() },
  { id: 'night', label: 'Сон через полночь', events: nightSleep() },
  { id: 'overlaps', label: 'Пересечения', events: overlaps() },
  { id: 'trip', label: 'Поездка', events: trip() },
  { id: 'edges', label: 'Граница недели', events: weekEdges() },
];
