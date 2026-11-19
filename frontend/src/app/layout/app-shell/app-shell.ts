import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeader } from '../app-header/app-header';

/**
 * Frame of the workspace screens (prototype): the header on top, the page below it
 * filling the rest of the window. The page scrolls inside `main`, the header stays.
 */
@Component({
  selector: 'tp-app-shell',
  imports: [RouterOutlet, AppHeader],
  template: `
    <tp-app-header />
    <main class="content">
      <router-outlet />
    </main>
  `,
  styleUrl: './app-shell.scss',
})
export class AppShell {}
