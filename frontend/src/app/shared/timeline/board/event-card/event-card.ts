import { Component, computed, input, output } from '@angular/core';
import type { Uuid } from '@core/api/models/common.models';
import type { EventBox } from '../../engine/model';

/**
 * An event card of the board (prototype `segView`, FD-55, FD-56): a button placed and sized
 * by the ready `EventBox` — it reads values and computes nothing but CSS strings.
 * `tall` shows the title and the time, `short` and `tiny` one line; a joint event carries
 * the «вместе» badge (two rings) on a tall card, the name of the button says «вместе»
 * on every card. The hover lift is CSS only; the shared hover of both copies of a joint
 * event comes with the store (WEEK-14).
 */
@Component({
  selector: 'tp-event-card',
  templateUrl: './event-card.html',
  styleUrl: './event-card.scss',
  host: {
    '[class.tall]': "box().density === 'tall'",
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

  /** Top corners, then bottom corners: the small radius on an edge that continues. */
  protected readonly radius = computed(() => {
    const { radiusTop: top, radiusBottom: bottom } = this.box();
    return `${top}px ${top}px ${bottom}px ${bottom}px`;
  });
}
