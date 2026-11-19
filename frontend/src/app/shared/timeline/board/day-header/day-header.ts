import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';
import type { IsoDate } from '@core/api/models/common.models';
import type { DayColumnLayout } from '../../engine/model';

/**
 * «Пн 9» above a day column; today's number in an accent circle (prototype). `&ngsp;`
 * keeps the space between the spans for screen readers (the flex gap draws it).
 *
 * With `interactive` the header is a button (prototype): on a week it opens that day, on an
 * open day (`open`) it returns to the week. Without it — a plain label (template preview).
 */
@Component({
  selector: 'tp-day-header',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #label>
      <span class="weekday">{{ day().weekdayShort }}</span>&ngsp;<span class="number">{{
        day().dayOfMonth
      }}</span>
    </ng-template>
    @if (interactive()) {
      <button
        type="button"
        class="hit"
        [attr.aria-label]="open() ? 'Вернуться к неделе' : 'Открыть день: ' + day().dateLabel"
        (click)="pick.emit(day().date)"
      >
        <ng-container *ngTemplateOutlet="label" />
      </button>
    } @else {
      <ng-container *ngTemplateOutlet="label" />
    }
  `,
  styleUrl: './day-header.scss',
  host: {
    '[class.today]': 'day().isToday',
    '[attr.aria-current]': "day().isToday ? 'date' : null",
  },
})
export class DayHeader {
  readonly day = input.required<DayColumnLayout>();
  readonly interactive = input(false);
  /** The board shows this one day: the header leads back to the week. */
  readonly open = input(false);
  /** The user chose this day (`interactive` only). */
  readonly pick = output<IsoDate>();
}
