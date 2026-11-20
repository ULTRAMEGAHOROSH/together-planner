import { Component, computed, input, output } from '@angular/core';
import type { Uuid } from '@core/api/models/common.models';
import { EventCard } from '../event-card/event-card';
import { NowIndicator } from '../now-indicator/now-indicator';
import { slotMinuteAt } from '../../engine/geometry';
import type { DayColumnLayout, NowMark } from '../../engine/model';
import type { SlotClick } from '../board.models';

/**
 * One day of a panel (prototype): hour grid, today / weekend background, and the whole
 * column as one button «Создать событие для …, понедельник, 9 ноября» (§8.3) — the start
 * minute comes from the click point. The event cards of the day stand above it (WEEK-06).
 */
@Component({
  selector: 'tp-day-column',
  imports: [EventCard, NowIndicator],
  template: `
    @if (!readOnly()) {
      <button
        type="button"
        class="slot"
        [attr.aria-label]="'Создать событие для ' + personName() + ', ' + day().dateLabel"
        (click)="onSlot($event)"
      ></button>
    }
    @for (box of day().boxes; track box.key) {
      <tp-event-card [box]="box" (eventClick)="eventClick.emit($event)" />
    }
    @if (nowTop() !== null) {
      <tp-now-indicator [top]="nowTop()!" />
    }
  `,
  styleUrl: './day-column.scss',
  host: {
    '[class.today]': 'day().isToday',
    '[class.weekend]': 'day().isWeekend',
  },
})
export class DayColumn {
  readonly day = input.required<DayColumnLayout>();
  readonly personId = input.required<Uuid>();
  readonly personName = input.required<string>();
  /** The «now» mark of the board; the line is drawn only in the column of its date. */
  readonly now = input<NowMark | null>(null);
  /** No empty-place buttons: nothing is created here (template preview). */
  readonly readOnly = input(false);
  readonly slotClick = output<SlotClick>();
  /** An event card was clicked: the intent to open the event. */
  readonly eventClick = output<Uuid>();

  protected readonly nowTop = computed(() => {
    const now = this.now();
    return now !== null && now.date === this.day().date ? now.top : null;
  });

  protected onSlot(event: MouseEvent): void {
    const slot = event.currentTarget as HTMLElement;
    // Enter / Space on the button click it with `detail = 0` and no point.
    const offset = event.detail === 0 ? null : event.clientY - slot.getBoundingClientRect().top;
    this.slotClick.emit({
      date: this.day().date,
      minute: slotMinuteAt(offset),
      personId: this.personId(),
    });
  }
}
