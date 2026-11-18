import { booleanAttribute, Component, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { Spinner } from '@shared/ui/spinner/spinner';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

/**
 * Button of the app (FD-41) on a native `<button>`: form submit, focus and keyboard stay
 * the browser's. `type` is set by the caller, as on any button.
 *
 * `loading` keeps the button focusable but blocks it: `aria-disabled`, a spinner, clicks
 * and form submit are cancelled (FD-83). `disabled` is the native attribute.
 *
 * ```html
 * <button tpButton type="submit" [loading]="saving()">Войти</button>
 * <button tpButton variant="ghost" type="button" (click)="cancel()">Отмена</button>
 * ```
 */
@Component({
  // A component on the native element, like `button[mat-button]`: a wrapper element
  // would hide the button from forms and keyboard.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[tpButton]',
  imports: [Spinner],
  templateUrl: './button.html',
  styleUrl: './button.scss',
  host: {
    '[class]': 'variant()',
    '[class.sm]': "size() === 'sm'",
    '[class.loading]': 'loading()',
    '[disabled]': 'disabled()',
    '[attr.aria-disabled]': "loading() ? 'true' : null",
    '[attr.aria-busy]': "loading() ? 'true' : null",
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  /** `md` 44 px (forms, dialogs), `sm` 40 px (toolbars). */
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    // The caller's `(click)` is registered before a host listener and would run first.
    // A capture listener on the target runs before all its bubble listeners (DOM spec), so
    // it can stop them; `preventDefault` cancels the form submit.
    const element = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
    const block = (event: Event) => {
      if (!this.loading()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    element.addEventListener('click', block, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      element.removeEventListener('click', block, { capture: true }),
    );
  }
}
