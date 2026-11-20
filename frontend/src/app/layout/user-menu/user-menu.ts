import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth-service';
import { SessionStore } from '@core/auth/session-store';
import { Avatar } from '@shared/ui/avatar/avatar';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { Menu, MenuItem, MenuTrigger } from '@shared/ui/menu/menu';
import { InviteDialog } from './invite-dialog';

/**
 * The members in the header are the menu button (prototype): the menu shows who is signed
 * in and offers «Настройки», «Пригласить по коду» (only while the partner is missing) and
 * «Выйти».
 */
@Component({
  selector: 'tp-user-menu',
  imports: [Avatar, Menu, MenuItem, MenuTrigger],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.scss',
})
export class UserMenu {
  private readonly session = inject(SessionStore);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly user = this.session.user;
  protected readonly members = this.session.members;
  protected readonly partnerMissing = this.session.isPartnerMissing;
  /** The button's name contains the names shown on it (WCAG 2.5.3). */
  protected readonly label = computed(
    () =>
      `Меню: ${this.members()
        .map((m) => m.displayName)
        .join(' и ')}`,
  );

  protected openSettings(): void {
    void this.router.navigateByUrl('/settings');
  }

  protected invite(): void {
    this.dialogs.open(InviteDialog, undefined, { size: 'sm' });
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
