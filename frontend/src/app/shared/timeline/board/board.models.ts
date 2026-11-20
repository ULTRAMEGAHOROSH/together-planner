import type { IsoDate, Uuid } from '@core/api/models/common.models';
import type { Seat } from '@core/api/models/workspace.models';
import type { PanelLayout } from '../engine/model';

/** One member's panel on the board: who (header) and the ready layout (FD-59). */
export interface BoardPanel {
  readonly name: string;
  readonly seat: Seat;
  readonly layout: PanelLayout;
}

/** A click on an empty place of a day column: the intent to create an event (§8.3). */
export interface SlotClick {
  readonly date: IsoDate;
  /** Minutes since midnight, rounded down to 30. */
  readonly minute: number;
  readonly personId: Uuid;
}

/**
 * The pointer entered (`anchor` is the card) or left (`null`) an event card (FD-59, WEEK-14).
 * The board only reports it; what to show is the page's business.
 */
export interface EventHover {
  readonly eventId: Uuid;
  readonly anchor: HTMLElement;
}
