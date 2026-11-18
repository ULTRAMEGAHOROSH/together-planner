import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { WorkspaceApi } from '@core/api/workspace-api';
import type { InviteResponse } from '@core/api/models/workspace.models';
import { SessionStore } from '@core/auth/session-store';
import { isApiError } from '@core/error/api-error';
import { messageFor } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { ZoneClock } from '@core/time/zone-clock';
import { dayMonthTime, parseInstant } from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { openConfirm } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Spinner } from '@shared/ui/spinner/spinner';
import { filter } from 'rxjs';

/** What the card shows while there is no code. */
type NoCode = 'loading' | 'full' | 'error';

/**
 * Invite for the partner (prototype «Пространство создано»): W5 on start → the code, the
 * join link and when the code expires. W5 deletes the workspace's unused codes, so «Новый
 * код» asks first. Public: also used in the user menu (SHELL-02) and settings (SET-01).
 */
@Component({
  selector: 'tp-invite-card',
  imports: [Button, ErrorState, Spinner],
  templateUrl: './invite-card.html',
  styleUrl: './invite-card.scss',
})
export class InviteCard {
  private readonly api = inject(WorkspaceApi);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly origin = inject(DOCUMENT).location.origin;

  private readonly current = signal<{ invite: InviteResponse; timeZone: string } | null>(null);
  protected readonly status = signal<NoCode>('loading');
  protected readonly errorText = signal('');
  /** «Новый код» is waiting for W5; the current code stays on the screen meanwhile. */
  protected readonly renewing = signal(false);

  protected readonly invite = computed(() => {
    const current = this.current();
    if (!current) {
      return null;
    }
    const { code, displayCode, expiresAt } = current.invite;
    return {
      displayCode,
      // The code without the dash goes into the link; the backend accepts both forms.
      link: `${this.origin}/join?code=${encodeURIComponent(code)}`,
      // In the workspace's zone, like every time in the app (FD-33).
      expires: dayMonthTime(this.clock.nowIn(current.timeZone, parseInstant(expiresAt))),
    };
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.request(() => undefined);
  }

  protected renew(): void {
    openConfirm(this.dialogs, {
      title: 'Создать новый код?',
      text: 'Прежний код перестанет работать: партнёр сможет присоединиться только по новому.',
      confirmLabel: 'Создать новый код',
    })
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.renewing.set(true);
        this.request(() => this.toast.show('Новый код создан, прежний больше не работает.'));
      });
  }

  protected copy(text: string, done: string): void {
    this.toast.show(
      this.clipboard.copy(text)
        ? done
        : 'Не удалось скопировать. Выделите текст и скопируйте вручную.',
    );
  }

  private request(onSuccess: () => void): void {
    const workspace = this.session.workspace();
    if (!workspace) {
      // The card is shown only inside a workspace; without one there is nothing to invite to.
      this.status.set('error');
      this.errorText.set('Сначала создайте пространство.');
      return;
    }
    this.api.createInvite(workspace.id).subscribe({
      next: (invite) => {
        this.renewing.set(false);
        this.current.set({ invite, timeZone: workspace.timeZone });
        onSuccess();
      },
      error: (error: unknown) => {
        this.renewing.set(false);
        if (isApiError(error) && error.code === 'WORKSPACE_FULL') {
          this.current.set(null);
          this.status.set('full');
        } else if (this.current()) {
          // «Новый код» failed: the shown code is still the latest one the user has.
          this.toast.error(error);
        } else {
          this.status.set('error');
          this.errorText.set(messageFor(error));
        }
      },
    });
  }
}
