import { Component, input, output } from '@angular/core';
import type { IsoDate } from '@core/api/models/common.models';
import type { EventResponse } from '@core/api/models/event.models';
import { styleOf } from '@shared/domain';
import { dateLong, WEEKDAYS_SHORT } from '@shared/time';
import type { CalendarDay } from '../calendar-store';

/** Pills in a cell; the rest is «+ ещё n» (prototype). */
export const MAX_PILLS = 3;

/**
 * The grid of the month (prototype `vCal`): seven columns, a cell per day with its number
 * («today» in the accent), up to three pills of manual events and how many events came from
 * templates. A click on a cell opens that day on the week; on a pill — the event.
 * Presentational: it only says what was clicked.
 */
@Component({
  selector: 'tp-month-grid',
  templateUrl: './month-grid.html',
  styleUrl: './month-grid.scss',
})
export class MonthGrid {
  readonly days = input.required<readonly CalendarDay[]>();
  /** A narrow screen: shorter cells, pills without the time, «+n» for the template events. */
  readonly narrow = input(false);
  readonly dayClick = output<IsoDate>();
  readonly eventClick = output<string>();

  protected readonly weekdays = WEEKDAYS_SHORT;
  protected readonly maxPills = MAX_PILLS;

  protected dayLabel(day: CalendarDay): string {
    return `Открыть неделю: ${dateLong(day.date)}`;
  }

  protected pillText(event: EventResponse): string {
    return this.narrow() ? event.title : `${event.start.slice(11, 16)} ${event.title}`;
  }

  protected pillStyle(event: EventResponse): Record<string, string> {
    const { bg, fg } = styleOf(event);
    return { background: bg, color: fg };
  }

  protected routineText(count: number): string {
    return this.narrow() ? `+${count}` : `${count} из шаблона`;
  }
}
