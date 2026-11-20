// Shows the hover card of an event beside the card under the pointer (WEEK-14). A short delay
// keeps it from flashing when the pointer only passes over; it is not shown on a screen without
// hover (touch). The overlay does not take the pointer (see `_overlay.scss`), so it can never
// sit between the cursor and the card.
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DestroyRef, inject, Injectable } from '@angular/core';
import type { EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { EventHovercard } from '@shared/timeline/board/event-hovercard/event-hovercard';

export const HOVERCARD_DELAY_MS = 250;

@Injectable()
export class EventHovercardService {
  private readonly overlay = inject(Overlay);
  private ref: OverlayRef | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  /** After the delay, the card of `event` next to `anchor`; a newer call replaces the older. */
  show(event: EventResponse, members: readonly MemberResponse[], anchor: HTMLElement): void {
    this.hide();
    if (!this.canHover()) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.open(event, members, anchor);
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

  private canHover(): boolean {
    return typeof matchMedia !== 'function' || matchMedia('(hover: hover)').matches;
  }

  private open(
    event: EventResponse,
    members: readonly MemberResponse[],
    anchor: HTMLElement,
  ): void {
    const ref = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(anchor)
        .withPositions([
          { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
          { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
          { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
          {
            originX: 'center',
            originY: 'top',
            overlayX: 'center',
            overlayY: 'bottom',
            offsetY: -8,
          },
        ])
        .withPush(true),
      panelClass: 'tp-hovercard-panel',
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    const card = ref.attach(new ComponentPortal(EventHovercard));
    card.setInput('event', event);
    card.setInput('members', members);
    this.ref = ref;
  }
}
