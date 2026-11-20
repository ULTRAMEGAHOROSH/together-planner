import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '@core/auth/session-store';
import { EventEditor } from '@features/events';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { Icon, type IconName } from '@shared/ui/icon/icon';
import { InviteDialog } from '../user-menu/invite-dialog';
import { UserMenu } from '../user-menu/user-menu';

interface Tab {
  readonly path: string;
  readonly label: string;
  /** Shown only on a narrow screen, above the label (SHELL-03). */
  readonly icon: IconName;
}

/** A tab stays active on its nested pages (week, template). */
const TABS: readonly Tab[] = [
  { path: '/week', label: 'Расписание', icon: 'schedule' },
  { path: '/calendar', label: 'Календарь', icon: 'calendar' },
  { path: '/templates', label: 'Шаблоны', icon: 'layers' },
];

/**
 * Header of the workspace screens (prototype): logo, section tabs, workspace name and the
 * members in seat order, which open the user menu. While the partner has not joined, «+»
 * «Пригласить» stands in for the second avatar (SHELL-04). «+ Событие» opens the event
 * dialog on the day on screen (EVT-04).
 */
@Component({
  selector: 'tp-app-header',
  imports: [RouterLink, RouterLinkActive, Icon, UserMenu],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
})
export class AppHeader {
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly editor = inject(EventEditor);

  protected readonly tabs = TABS;
  protected readonly workspace = this.session.workspace;
  protected readonly partnerMissing = this.session.isPartnerMissing;

  protected newEvent(): void {
    this.editor.openCreateDefault();
  }

  /** The same dialog as «Пригласить по коду» in the user menu: no code until asked. */
  protected invite(): void {
    this.dialogs.open(InviteDialog, undefined, { size: 'sm' });
  }
}
