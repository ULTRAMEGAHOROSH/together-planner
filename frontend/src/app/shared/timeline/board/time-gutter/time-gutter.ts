import { Component } from '@angular/core';
import { HOUR_MARKS } from '../../engine/geometry';

/**
 * The time scale between the panels: «время» in the sticky header, 01:00…23:00 on the hour
 * lines. Decorative for screen readers: every card and column says its own time.
 */
@Component({
  selector: 'tp-time-gutter',
  template: `
    <div class="head"><span>время</span></div>
    <div class="hours">
      @for (mark of marks; track mark.label) {
        <span class="hour" [style.top.px]="mark.top">{{ mark.label }}</span>
      }
    </div>
  `,
  styleUrl: './time-gutter.scss',
  host: { 'aria-hidden': 'true' },
})
export class TimeGutter {
  protected readonly marks = HOUR_MARKS;
}
