// Modal dialogs on top of CDK Dialog (FD-40): one look and behavior for all of them.
// Backdrop, Esc and click outside close the dialog with `undefined`; focus is trapped
// inside and returns to the element that opened the dialog.
import { Dialog } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

/** Width: `sm` 440 px (confirmation), `md` 580 px (event form), `lg` 680 px (apply template). */
export type DialogSize = 'sm' | 'md' | 'lg';

export interface DialogOptions {
  size?: DialogSize;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);
  private nextId = 1;

  /**
   * Opens `component` at once. The component reads `data` with `inject(DIALOG_DATA)` and
   * closes itself with `inject(DialogRef).close(result)`. The observable emits the result
   * (`undefined` for Esc, click outside or the close button) once and completes.
   */
  open<R, D = unknown, C = unknown>(
    component: ComponentType<C>,
    data?: D,
    { size = 'md' }: DialogOptions = {},
  ): Observable<R | undefined> {
    const ref = this.dialog.open<R, D, C>(component, {
      data,
      // <tp-dialog-shell> gives its title this id: the dialog gets the title as its name.
      ariaLabelledBy: `tp-dialog-title-${this.nextId++}`,
      ariaModal: true,
      panelClass: ['tp-dialog-panel', `tp-dialog-panel--${size}`],
      backdropClass: 'tp-dialog-backdrop',
      // Sizes come from the panel classes (styles/_overlay.scss), not CDK defaults (80vw).
      maxWidth: '',
    });
    return ref.closed;
  }
}
