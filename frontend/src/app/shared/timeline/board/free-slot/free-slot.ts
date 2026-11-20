import { Component, input } from '@angular/core';
import type { FreeSlotBox } from '../../engine/model';

/**
 * A gap in which both are free (prototype, WEEK-15): a dashed green block with «Оба свободны»
 * and the time when they fit. Decorative — the same free time is read from the schedule — and
 * it takes no pointer: a click goes through to the empty place of the day below it.
 */
@Component({
  selector: 'tp-free-slot',
  templateUrl: './free-slot.html',
  styleUrl: './free-slot.scss',
  host: {
    'aria-hidden': 'true',
    '[style.top.px]': 'slot().top',
    '[style.height.px]': 'slot().height',
  },
})
export class FreeSlot {
  readonly slot = input.required<FreeSlotBox>();
}
