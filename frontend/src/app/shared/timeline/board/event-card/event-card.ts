import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import type { Uuid } from '@core/api/models/common.models';
import type { EventBox } from '../../engine/model';
import type { EventHover } from '../board.models';

/**
 * An event card of the board (prototype `segView`, FD-55, FD-56): a button placed and sized
 * by the ready `EventBox` — it reads values and computes nothing but CSS strings.
 * `tall` shows the title and the time, `short` and `tiny` one line; a joint event carries
 * the «вместе» badge (two rings) on a tall card, the name of the button says «вместе»
 * on every card. The ring is CSS: under the pointer, on focus and — `highlighted` — when the
 * other copy of a joint event is hovered (WEEK-14).
 */
@Component({
  selector: 'tp-event-card',
  templateUrl: './event-card.html',
  styleUrl: './event-card.scss',
  host: {
    '[class.tall]': "box().density === 'tall'",
    '[class.highlighted]': 'highlighted()',
    '(mouseenter)': 'hover.emit({ eventId: box().eventId, anchor: element })',
    '(mouseleave)': 'hover.emit(null)',
    '[style.top.px]': 'box().top',
    '[style.height.px]': 'box().height',
    '[style.left]': "'calc(' + box().leftPct + '% + 2px)'",
    '[style.width]': "'calc(' + box().widthPct + '% - 4px)'",
    '[style.border-radius]': 'radius()',
    '[style.font-size.px]': 'box().fontSize',
    '[style.--ev-bg]': 'box().colors.bg',
    '[style.--ev-fg]': 'box().colors.fg',
    '[style.--ev-dot]': 'box().colors.dot',
  },
})
export class EventCard {
  readonly box = input.required<EventBox>();
  /** The card was clicked or activated: open the event. */
  readonly eventClick = output<Uuid>();
  /** The same ring as under the pointer: the other copy of a joint event is hovered (WEEK-14). */
  readonly highlighted = input(false);
  /** The pointer came onto the card (with the card) or left it (`null`). */
  readonly hover = output<EventHover | null>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Top corners, then bottom corners: the small radius on an edge that continues. */
  protected readonly radius = computed(() => {
    const { radiusTop: top, radiusBottom: bottom } = this.box();
    return `${top}px ${top}px ${bottom}px ${bottom}px`;
  });
}
