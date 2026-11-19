import { Component, input } from '@angular/core';
import type { DayColumnLayout } from '../../engine/model';

/**
 * «Пн 9» above a day column; today's number in an accent circle (prototype). `&ngsp;`
 * keeps the space between the spans for screen readers (the flex gap draws it).
 */
@Component({
  selector: 'tp-day-header',
  template: `
    <span class="weekday">{{ day().weekdayShort }}</span>&ngsp;<span class="number">{{
      day().dayOfMonth
    }}</span>
  `,
  styleUrl: './day-header.scss',
  host: {
    '[class.today]': 'day().isToday',
    '[attr.aria-current]': "day().isToday ? 'date' : null",
  },
})
export class DayHeader {
  readonly day = input.required<DayColumnLayout>();
}
