import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { WorkspaceResponse } from '@core/api/models/workspace.models';
import {
  AUTH_RESPONSE,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { AppHeader } from './app-header';

@Component({ template: '' })
class Page {}

describe('AppHeader', () => {
  let fixture: ComponentFixture<AppHeader>;
  let session: SessionStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'week', component: Page },
          { path: 'week/:weekStart', component: Page },
          { path: 'templates', component: Page },
          { path: 'templates/:templateId', component: Page },
        ]),
      ],
    });
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    fixture = TestBed.createComponent(AppHeader);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const tabs = () => Array.from(el().querySelectorAll<HTMLAnchorElement>('nav a'));
  const current = () =>
    tabs()
      .filter((a) => a.getAttribute('aria-current') === 'page')
      .map((a) => a.textContent?.trim());
  const members = () =>
    Array.from(el().querySelectorAll('tp-user-menu .member')).map((li) => ({
      name: li.querySelector('.member-name')?.textContent,
      avatar: li.querySelector('tp-avatar')?.textContent,
      seat1: li.querySelector('tp-avatar')?.classList.contains('seat-1'),
    }));
  async function go(url: string) {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  }

  it('logo and the section tabs of the prototype, as links', () => {
    expect(el().querySelector('.brand')?.textContent?.trim()).toBe('Together');
    expect(el().querySelector('nav')?.getAttribute('aria-label')).toBe('Разделы');
    expect(tabs().map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Расписание', '/week'],
      ['Шаблоны', '/templates'],
    ]);
  });

  it('each tab has its icon for the narrow header (SHELL-03) and the label as its name', () => {
    const icon = (a: HTMLAnchorElement) => a.querySelector('tp-icon');
    // `schedule` is the only icon drawn with a <rect>; `layers` is two paths.
    expect(icon(tabs()[0])?.querySelector('rect')).not.toBeNull();
    expect(icon(tabs()[1])?.querySelectorAll('path')).toHaveLength(2);
    expect(tabs().map((a) => a.querySelector('.tab-label')?.textContent)).toEqual([
      'Расписание',
      'Шаблоны',
    ]);
    // Decorative: the link keeps the label as its accessible name.
    expect(tabs().map((a) => icon(a)?.getAttribute('aria-hidden'))).toEqual(['true', 'true']);
  });

  it.each([
    ['/week', 'Расписание'],
    ['/week/2026-11-16', 'Расписание'],
    ['/templates', 'Шаблоны'],
    ['/templates/new', 'Шаблоны'],
  ])('on %s the active tab is «%s» (aria-current, class)', async (url, label) => {
    await go(url);
    expect(current()).toEqual([label]);
    const active = tabs().filter((a) => a.classList.contains('active'));
    expect(active.map((a) => a.textContent?.trim())).toEqual([label]);
  });

  it('two members in seat order, whatever the order in the response', async () => {
    const [first, second] = WORKSPACE_FULL_PAIR.members;
    const reversed: WorkspaceResponse = { ...WORKSPACE_FULL_PAIR, members: [second, first] };
    session.setWorkspace(reversed);
    await fixture.whenStable();
    const trigger = el().querySelector('tp-user-menu button');
    expect(trigger?.getAttribute('aria-label')).toBe(
      `Меню: ${first.displayName} и ${second.displayName}`,
    );
    expect(members()).toEqual([
      { name: first.displayName, avatar: first.displayName[0], seat1: true },
      { name: second.displayName, avatar: second.displayName[0], seat1: false },
    ]);
  });

  it('the workspace name; alone in it → one avatar, the partner appears with the session', async () => {
    session.setWorkspace(WORKSPACE_CREATED);
    await fixture.whenStable();
    expect(el().querySelector('.workspace-name')?.textContent).toBe(WORKSPACE_CREATED.name);
    expect(members().map((m) => m.name)).toEqual([WORKSPACE_CREATED.members[0].displayName]);

    session.setWorkspace(WORKSPACE_FULL_PAIR);
    await fixture.whenStable();
    expect(members()).toHaveLength(2);
  });

  it('the only button is the members one (user menu); «+ Событие» comes in EVT-04', () => {
    const buttons = Array.from(el().querySelectorAll('button'));
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-haspopup')).toBe('menu');
  });

  it('without a workspace (session cleared on logout) → no workspace block', async () => {
    session.clear();
    await fixture.whenStable();
    expect(el().querySelector('.workspace')).toBeNull();
    expect(tabs()).toHaveLength(2);
  });
});
