import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';

/**
 * «Партнёр изменил это событие» (409 `VERSION_CONFLICT` on save or delete, OQ-2: for now only
 * «load the current one»). Closes with `true` on «Загрузить актуальную версию» and with
 * `undefined` on cancel, Esc or click outside. Focus starts on «Отмена».
 */
@Component({
  selector: 'tp-event-conflict-dialog',
  imports: [Button, DialogShell],
  templateUrl: './event-conflict-dialog.html',
  styleUrl: './event-conflict-dialog.scss',
})
export class EventConflictDialog {
  protected readonly ref = inject<DialogRef<true>>(DialogRef);
}
