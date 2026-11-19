import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '@core/auth/session-store';
import { UserMenu } from '../user-menu/user-menu';

interface Tab {
  readonly path: string;
  readonly label: string;
}

/** «Календарь» joins in CAL-01. A tab stays active on its nested pages (week, template). */
const TABS: readonly Tab[] = [
  { path: '/week', label: 'Расписание' },
  { path: '/templates', label: 'Шаблоны' },
];

/**
 * Header of the workspace screens (prototype): logo, section tabs, workspace name and the
 * members in seat order, which open the user menu. «+ Событие» comes in EVT-04.
 */
@Component({
  selector: 'tp-app-header',
  imports: [RouterLink, RouterLinkActive, UserMenu],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
})
export class AppHeader {
  private readonly session = inject(SessionStore);

  protected readonly tabs = TABS;
  protected readonly workspace = this.session.workspace;
}
