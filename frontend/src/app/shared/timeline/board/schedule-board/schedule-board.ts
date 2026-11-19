import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import type { Uuid } from '@core/api/models/common.models';
import { PX_PER_HOUR, SCROLL_START_TOP, WEEK_MIN_WIDTH } from '../../engine/constants';
import type { BoardPanel, SlotClick } from '../board.models';
import { PersonPanel } from '../person-panel/person-panel';
import { TimeGutter } from '../time-gutter/time-gutter';

/**
 * The schedule board (FD-57…59): ONE scroll container (this element) holding
 * [panel A] [time] [panel B]; the headers are sticky inside it, so both panels and the
 * scale scroll together without any JavaScript sync. Presentational: data only through
 * `panels`, intents only through outputs. Opens scrolled to 06:00 (FD-58).
 * Expects the two panels of a pair; the panel of a missing partner comes in WEEK-10.
 */
@Component({
  selector: 'tp-schedule-board',
  imports: [PersonPanel, TimeGutter],
  templateUrl: './schedule-board.html',
  styleUrl: './schedule-board.scss',
  host: { '[style.--board-hour]': 'hourHeight' },
})
export class ScheduleBoard {
  readonly panels = input.required<readonly BoardPanel[]>();
  readonly slotClick = output<SlotClick>();
  /** A card was clicked or activated: `eventId` to open (FD-59). */
  readonly eventClick = output<Uuid>();

  protected readonly hourHeight = `${PX_PER_HOUR}px`;
  /** «Неделя» keeps its width and scrolls sideways; «День» fits any screen (FD-57). */
  protected readonly minWidth = computed(() =>
    this.panels().some((p) => p.layout.days.length > 1) ? WEEK_MIN_WIDTH : null,
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      host.scrollTop = SCROLL_START_TOP;
    });
  }
}
