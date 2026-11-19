import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '@core/auth/session-store';
import { Button } from '@shared/ui/button/button';
import { JoinWorkspaceForm } from '../join-workspace-form/join-workspace-form';

/**
 * The invite link `/join?code=` (WS-06). A guest never gets here: `inviteeGuard` sends them
 * to registration and back. Without a workspace — the join form with the code filled in,
 * sent only by the user's click; with one — there is nothing to join.
 */
@Component({
  selector: 'tp-join-link-page',
  imports: [Button, JoinWorkspaceForm],
  templateUrl: './join-link-page.html',
  styleUrl: './join-link-page.scss',
})
export class JoinLinkPage {
  /** `?code=` of the link. */
  readonly code = input<string>();

  private readonly router = inject(Router);
  protected readonly workspace = inject(SessionStore).workspace;

  protected toSchedule(): void {
    void this.router.navigateByUrl('/week');
  }
}
