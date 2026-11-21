// Shows the inspector of a hovered event (WEEK-14, prototype «инспектор»): a card fixed in the
// bottom-left corner of the window — and in the bottom-right one when the hovered card is
// there, so it never sits on the card under the pointer. A short delay keeps it from flashing
// when the pointer only passes over; it is not shown on a screen without hover (touch), on a
// narrow screen, or while a dialog is open. The overlay takes no pointer (see `_overlay.scss`).
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DestroyRef, inject, Injectable } from '@angular/core';
import type { EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { NARROW_BREAKPOINT } from '@shared/timeline/engine/constants';
import { EventHovercard } from '@shared/timeline/board/event-hovercard/event-hovercard';
import { DialogService } from '@shared/ui/dialog/dialog-service';

export const HOVERCARD_DELAY_MS = 120;
/** The card: 310 px wide at 20 px from the edge; about this tall. */
const CORNER = { width: 310, height: 260, margin: 20 };

@Injectable()
export class EventHovercardService {
  private readonly overlay = inject(Overlay);
  private readonly dialogs = inject(DialogService);
  private ref: OverlayRef | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  /** After the delay, the inspector of `event`; a newer call replaces the older. */
  show(event: EventResponse, members: readonly MemberResponse[], anchor: HTMLElement): void {
    this.hide();
    if (!this.canShow()) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.dialogs.hasOpen()) {
        this.open(event, members, anchor);
      }
    }, HOVERCARD_DELAY_MS);
  }

  hide(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.ref?.dispose();
    this.ref = null;
  }

  private canShow(): boolean {
    const hover = typeof matchMedia !== 'function' || matchMedia('(hover: hover)').matches;
    return hover && window.innerWidth >= NARROW_BREAKPOINT && !this.dialogs.hasOpen();
  }

  /** The hovered card lies where the inspector would stand: use the other corner. */
  private leftCornerIsTaken(anchor: HTMLElement): boolean {
    const box = anchor.getBoundingClientRect();
    return (
      box.left < CORNER.margin + CORNER.width &&
      box.right > CORNER.margin &&
      box.bottom > window.innerHeight - CORNER.margin - CORNER.height
    );
  }

  private open(
    event: EventResponse,
    members: readonly MemberResponse[],
    anchor: HTMLElement,
  ): void {
    const global = this.overlay.position().global().bottom(`${CORNER.margin}px`);
    const strategy = this.leftCornerIsTaken(anchor)
      ? global.right(`${CORNER.margin}px`)
      : global.left(`${CORNER.margin}px`);
    const ref = this.overlay.create({
      positionStrategy: strategy,
      panelClass: 'tp-hovercard-panel',
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    const card = ref.attach(new ComponentPortal(EventHovercard));
    card.setInput('event', event);
    card.setInput('members', members);
    this.ref = ref;
  }
}
