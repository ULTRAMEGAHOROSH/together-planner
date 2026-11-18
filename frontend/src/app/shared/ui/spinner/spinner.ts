import { Component, input } from '@angular/core';

/**
 * Loading indicator: a ring in `currentColor`. With a `label` it is a status message for
 * screen readers; with `[label]="null"` it is decorative (e.g. inside a busy button).
 */
@Component({
  selector: 'tp-spinner',
  templateUrl: './spinner.html',
  styleUrl: './spinner.scss',
  host: {
    '[class.sm]': "size() === 'sm'",
    '[attr.role]': "label() ? 'status' : null",
    '[attr.aria-hidden]': "label() ? null : 'true'",
  },
})
export class Spinner {
  readonly label = input<string | null>('Загрузка…');
  /** `sm` 16 px (inside buttons), `md` 24 px (screens). */
  readonly size = input<'sm' | 'md'>('md');
}
