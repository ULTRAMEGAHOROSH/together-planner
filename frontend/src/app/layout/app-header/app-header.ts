import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '@core/auth/session-store';
import { Icon, type IconName } from '@shared/ui/icon/icon';
import { UserMenu } from '../user-menu/user-menu';

interface Tab {
  readonly path: string;
  readonly label: string;
  /** Shown only on a narrow screen, above the label (SHELL-03). */
  readonly icon: IconName;
}

/** «Календарь» joins in CAL-01. A tab stays active on its nested pages (week, template). */
const TABS: readonly Tab[] = [
  { path: '/week', label: 'Расписание', icon: 'schedule' },
  { path: '/templates', label: 'Шаблоны', icon: 'layers' },
];

/**
 * Header of the workspace screens (prototype): logo, section tabs, workspace name and the
 * members in seat order, which open the user menu. «+ Событие» comes in EVT-04.
 */
@Component({
  selector: 'tp-app-header',
  imports: [RouterLink, RouterLinkActive, Icon, UserMenu],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
})
export class AppHeader {
  private readonly session = inject(SessionStore);

  protected readonly tabs = TABS;
  protected readonly workspace = this.session.workspace;
}
