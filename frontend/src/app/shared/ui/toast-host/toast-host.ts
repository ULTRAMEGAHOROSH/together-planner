import { Component, computed, inject } from '@angular/core';
import { ToastService } from '@core/notify/toast-service';

/**
 * Shows the current toast (FD-68). Placed once, in `App`.
 *
 * Screen readers: the text is announced by a live region that always stays in the DOM
 * (a region added together with its text is often not read). The visible copy of the
 * text is hidden from them, so it is not read twice.
 */
@Component({
  selector: 'tp-toast-host',
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.scss',
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
  /** 0 or 1 item: `@for … track id` re-creates the card (and its animation) for a new toast. */
  protected readonly visible = computed(() => {
    const toast = this.toasts.current();
    return toast ? [toast] : [];
  });

  private hovered = false;
  private focused = false;

  protected setHovered(value: boolean): void {
    this.hovered = value;
    this.updateTimer();
  }

  protected setFocused(value: boolean): void {
    this.focused = value;
    this.updateTimer();
  }

  private updateTimer(): void {
    if (this.hovered || this.focused) {
      this.toasts.pause();
    } else {
      this.toasts.resume();
    }
  }
}
