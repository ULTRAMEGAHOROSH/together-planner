import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import type { Observable } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  text: string;
  /** Text of the dangerous action, e.g. «Удалить». */
  confirmLabel: string;
  cancelLabel?: string;
}

/**
 * «Are you sure?» for a destructive action. Closes with `true` on confirm and with
 * `undefined` on cancel, Esc or click outside. Focus starts on «Отмена»: Enter right
 * after opening must not destroy anything.
 */
@Component({
  selector: 'tp-confirm-dialog',
  imports: [Button, DialogShell],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<true>>(DialogRef);
}

/** Opens {@link ConfirmDialog}: emits `true` if the user confirmed, otherwise `undefined`. */
export function openConfirm(
  dialogs: DialogService,
  data: ConfirmDialogData,
): Observable<true | undefined> {
  return dialogs.open<true, ConfirmDialogData>(ConfirmDialog, data, { size: 'sm' });
}
