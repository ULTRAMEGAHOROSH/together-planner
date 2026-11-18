// Short notifications with an optional action, as in the prototype (FD-68).
// One toast at a time: a new one replaces the current one. Shown by <tp-toast-host>.
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { messageFor } from '@core/error/error-messages';

export const TOAST_DURATION_MS = 4800;

export interface ToastAction {
  /** Button text, e.g. «Показать». */
  label: string;
  run: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  durationMs?: number;
}

export interface Toast {
  /** Changes with every `show`, so the host can tell a new toast from the old one. */
  id: number;
  text: string;
  action: ToastAction | null;
  durationMs: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly state = signal<Toast | null>(null);
  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The visible toast, or `null`. */
  readonly current = this.state.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  show(text: string, { action, durationMs = TOAST_DURATION_MS }: ToastOptions = {}): void {
    this.state.set({ id: this.nextId++, text, action: action ?? null, durationMs });
    this.startTimer(durationMs);
  }

  /** Shows the user text for any error (`ApiError` or not), FD-67. */
  error(error: unknown): void {
    this.show(messageFor(error));
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.state.set(null);
  }

  /** Runs the action of the current toast and closes it. */
  runAction(): void {
    const action = this.state()?.action;
    this.dismiss();
    action?.run();
  }

  /** Stops the auto-hide timer while the user points at or focuses the toast. */
  pause(): void {
    clearTimeout(this.timer);
  }

  /** Starts the full duration again after `pause`. */
  resume(): void {
    const toast = this.state();
    if (toast) {
      this.startTimer(toast.durationMs);
    }
  }

  private startTimer(durationMs: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.state.set(null), durationMs);
  }
}
