import { Component, input } from '@angular/core';

/**
 * The red «now» line across today's column with the dot at its left end (prototype).
 * Decorative and click-through: the time is in the gutter label and in the cards.
 */
@Component({
  selector: 'tp-now-indicator',
  template: '<span class="dot"></span>',
  styleUrl: './now-indicator.scss',
  host: { 'aria-hidden': 'true', '[style.top.px]': 'top()' },
})
export class NowIndicator {
  /** px from the day's midnight. */
  readonly top = input.required<number>();
}
