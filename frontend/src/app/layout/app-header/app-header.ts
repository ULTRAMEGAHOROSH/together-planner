import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '@core/auth/session-store';
import { Avatar } from '@shared/ui/avatar/avatar';

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
 * Header of the workspace screens (prototype): logo, section tabs, workspace name and
 * members in seat order. «+ Событие» comes in EVT-04, the user menu in SHELL-02.
 */
@Component({
  selector: 'tp-app-header',
  imports: [RouterLink, RouterLinkActive, Avatar],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
})
export class AppHeader {
  private readonly session = inject(SessionStore);

  protected readonly tabs = TABS;
  protected readonly workspace = this.session.workspace;
  protected readonly members = this.session.members;
}
