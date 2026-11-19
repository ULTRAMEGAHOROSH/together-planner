import { Component, input, output } from '@angular/core';
import type { Uuid } from '@core/api/models/common.models';
import { EventCard } from '../event-card/event-card';
import { slotMinuteAt } from '../../engine/geometry';
import type { DayColumnLayout } from '../../engine/model';
import type { SlotClick } from '../board.models';

/**
 * One day of a panel (prototype): hour grid, today / weekend background, and the whole
 * column as one button «Создать событие для …, понедельник, 9 ноября» (§8.3) — the start
 * minute comes from the click point. The event cards of the day stand above it (WEEK-06).
 */
@Component({
  selector: 'tp-day-column',
  imports: [EventCard],
  template: `
    <button
      type="button"
      class="slot"
      [attr.aria-label]="'Создать событие для ' + personName() + ', ' + day().dateLabel"
      (click)="onSlot($event)"
    ></button>
    @for (box of day().boxes; track box.key) {
      <tp-event-card [box]="box" (eventClick)="eventClick.emit($event)" />
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
  readonly slotClick = output<SlotClick>();
  /** An event card was clicked: the intent to open the event. */
  readonly eventClick = output<Uuid>();

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
