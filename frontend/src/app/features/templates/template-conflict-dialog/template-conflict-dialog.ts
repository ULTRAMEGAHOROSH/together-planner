import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';

/**
 * «Партнёр изменил этот шаблон» (409 `VERSION_CONFLICT` on save, like the event one). Closes
 * with `true` on «Загрузить актуальную версию» and with `undefined` on cancel, Esc or click
 * outside. Focus starts on «Отмена».
 */
@Component({
  selector: 'tp-template-conflict-dialog',
  imports: [Button, DialogShell],
  template: `
    <tp-dialog-shell title="Партнёр изменил этот шаблон">
      <p>
        Пока вы правили, сохранилась другая версия. Если загрузить актуальную, ваши правки в форме
        заменятся ею.
      </p>
      <button
        tpButton
        tpDialogFooter
        variant="ghost"
        type="button"
        cdkFocusInitial
        (click)="ref.close()"
      >
        Отмена
      </button>
      <button tpButton tpDialogFooter type="button" (click)="ref.close(true)">
        Загрузить актуальную версию
      </button>
    </tp-dialog-shell>
  `,
  styles: `
    p {
      margin: 0;
      line-height: 1.5;
    }
  `,
})
export class TemplateConflictDialog {
  protected readonly ref = inject<DialogRef<true>>(DialogRef);
}
