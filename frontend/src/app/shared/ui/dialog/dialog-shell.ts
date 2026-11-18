import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, input } from '@angular/core';

let fallbackId = 1;

/**
 * Layout of a dialog: title with a close button, body (default content) and footer
 * (elements marked `tpDialogFooter`, aligned to the right; the footer sticks to the bottom).
 *
 * ```html
 * <tp-dialog-shell title="Удалить шаблон?">
 *   <p>…</p>
 *   <button tpDialogFooter type="button" (click)="ref.close()">Отмена</button>
 * </tp-dialog-shell>
 * ```
 */
@Component({
  selector: 'tp-dialog-shell',
  templateUrl: './dialog-shell.html',
  styleUrl: './dialog-shell.scss',
})
export class DialogShell {
  readonly title = input.required<string>();

  private readonly ref = inject(DialogRef, { optional: true });
  /** DialogService puts this id into `aria-labelledby` of the dialog. */
  protected readonly titleId =
    this.ref?.config.ariaLabelledBy ?? `tp-dialog-title-x${fallbackId++}`;

  protected close(): void {
    this.ref?.close();
  }
}
