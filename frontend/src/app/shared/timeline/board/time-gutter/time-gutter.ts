import { Component, input } from '@angular/core';
import { HOUR_MARKS } from '../../engine/geometry';
import type { NowMark } from '../../engine/model';

/**
 * The time scale between the panels: «время» in the sticky header, 01:00…23:00 on the hour
 * lines and, while today is on the board, the red label of the current time. Decorative for screen readers: every card and column says its own time.
 */
@Component({
  selector: 'tp-time-gutter',
  template: `
    <div class="head"><span>время</span></div>
    <div class="hours">
      @for (mark of marks; track mark.label) {
        <span class="hour" [style.top.px]="mark.top">{{ mark.label }}</span>
      }
      @if (now(); as mark) {
        <span class="now" [style.top.px]="mark.top">{{ mark.label }}</span>
      }
    </div>
  `,
  styleUrl: './time-gutter.scss',
  host: { 'aria-hidden': 'true' },
})
export class TimeGutter {
  /** The «now» label, when today is among the displayed days. */
  readonly now = input<NowMark | null>(null);

  protected readonly marks = HOUR_MARKS;
}
