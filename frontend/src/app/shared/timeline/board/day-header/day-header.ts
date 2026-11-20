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
      <span class="weekday">{{ day().weekdayShort }}</span>
      @if (day().dayOfMonth !== null) {
        &ngsp;<span class="number">{{ day().dayOfMonth }}</span>
      }
    </ng-template>
    @if (interactive()) {
      <button
        type="button"
        class="hit"
        [attr.aria-label]="accessibleName()"
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
  /** Starts with the visible text «Пн 9» (WCAG 2.5.3: the name contains what is shown). */
  protected accessibleName(): string {
    const d = this.day();
    const shown = d.dayOfMonth === null ? d.weekdayShort : d.weekdayShort + ' ' + d.dayOfMonth;
    return shown + ' — ' + (this.open() ? 'вернуться к неделе' : 'открыть день: ' + d.dateLabel);
  }
  readonly interactive = input(false);
  /** The board shows this one day: the header leads back to the week. */
  readonly open = input(false);
  /** The user chose this day (`interactive` only). */
  readonly pick = output<IsoDate>();
}
