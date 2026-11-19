import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { InviteCard } from '@features/onboarding';
import { Button } from '@shared/ui/button/button';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';

/**
 * «Пригласить по коду» from the user menu. The card waits for «Получить код»: opening the
 * dialog again must not cancel a code that was already sent (W5 always issues a new one).
 */
@Component({
  selector: 'tp-invite-dialog',
  imports: [Button, DialogShell, InviteCard],
  template: `
    <tp-dialog-shell title="Пригласить партнёра">
      <tp-invite-card [issueOnStart]="false" />
      <button tpButton tpDialogFooter variant="ghost" type="button" (click)="ref.close()">
        Готово
      </button>
    </tp-dialog-shell>
  `,
})
export class InviteDialog {
  protected readonly ref = inject(DialogRef);
}
