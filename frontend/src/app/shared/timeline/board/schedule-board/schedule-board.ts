import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import { ZoneClock } from '@core/time/zone-clock';
import { PX_PER_HOUR, SCROLL_START_TOP, WEEK_MIN_WIDTH } from '../../engine/constants';
import { nowMark, sameNowMark } from '../../engine/now-mark';
import type { BoardPanel, EventHover, SlotClick } from '../board.models';
import { PersonPanel } from '../person-panel/person-panel';
import { TimeGutter } from '../time-gutter/time-gutter';

/**
 * The schedule board (FD-57…59): ONE scroll container (this element) holding
 * [panel A] [time] [panel B]; the headers are sticky inside it, so both panels and the
 * scale scroll together without any JavaScript sync. Presentational: data only through
 * `panels`, intents only through outputs. Opens scrolled to 06:00 (FD-58).
 * Two panels, or one: then the right half is the content marked `tpPartnerPlaceholder`
 * (the invite card while the partner has not joined, WEEK-10).
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
  /**
   * IANA zone of the workspace: with it the board draws the «now» line (FD-33); `null` — no
   * line (template preview).
   */
  readonly timeZone = input<string | null>(null);
  /**
   * The day headers are buttons (the week page: open a day, back to the week); a template
   * preview leaves them plain.
   */
  readonly dayNavigation = input(false);
  /** Cards can be opened, but no place is a button to create an event (template preview). */
  readonly readOnly = input(false);
  readonly slotClick = output<SlotClick>();
  /** A day header was chosen: the day to open, or to leave when it is already open. */
  readonly dayClick = output<IsoDate>();
  /** A card was clicked or activated: `eventId` to open (FD-59). */
  readonly eventClick = output<Uuid>();
  /** The event whose cards in every panel carry the ring (WEEK-14); `null` — none. */
  readonly highlightedEventId = input<Uuid | null>(null);
  /** The pointer is on a card (the card to anchor to) or left it (`null`). */
  readonly eventHover = output<EventHover | null>();

  private readonly clock = inject(ZoneClock);

  /**
   * Where «now» is, once a minute (`minuteTick`); `null` when there is no zone or today is
   * not among the displayed days. An equal mark is the same value: nothing is redrawn.
   */
  protected readonly now = computed(
    () => {
      const zone = this.timeZone();
      if (zone === null) return null;
      const mark = nowMark(this.clock.nowIn(zone, this.clock.minuteTick()));
      const shown = this.panels().some((p) => p.layout.days.some((d) => d.date === mark.date));
      return shown ? mark : null;
    },
    { equal: sameNowMark },
  );

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
