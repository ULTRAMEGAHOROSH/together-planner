// Test helpers for dialogs (used only by *.spec.ts).
import { InteractivityChecker } from '@angular/cdk/a11y';
import { Injectable, type Provider } from '@angular/core';

/**
 * jsdom has no layout, so CDK sees every element as invisible and the focus trap finds
 * nothing to focus. This checker treats all elements as visible; the rest is CDK logic.
 */
@Injectable()
class VisibleInteractivityChecker extends InteractivityChecker {
  override isVisible(): boolean {
    return true;
  }
}

export const provideVisibleElements = (): Provider => ({
  provide: InteractivityChecker,
  useClass: VisibleInteractivityChecker,
});

/** The open dialog container rendered by CDK at the end of <body>. */
export const dialogElement = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.cdk-dialog-container');

/** CDK listens for keys on <body> (OverlayKeyboardDispatcher). */
export function pressEscape(): void {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }),
  );
}
