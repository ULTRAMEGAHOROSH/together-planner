import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { WorkspaceResponse } from '@core/api/models/workspace.models';
import {
  AUTH_RESPONSE,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { EventEditor } from '@features/events';
import { dialogElement, provideVisibleElements } from '@shared/ui/dialog/testing';
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
          { path: 'calendar', component: Page },
          { path: 'templates', component: Page },
          { path: 'templates/:templateId', component: Page },
        ]),
        provideVisibleElements(),
      ],
    });
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    fixture = TestBed.createComponent(AppHeader);
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.querySelector('.cdk-overlay-container')?.remove();
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
  const invite = () => el().querySelector<HTMLButtonElement>('button.invite');
  async function go(url: string) {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  }

  it('«+ Событие» opens the new event on the day on screen; the name is in aria-label', () => {
    const open = vi.spyOn(TestBed.inject(EventEditor), 'openCreateDefault').mockReturnValue();
    const button = el().querySelector<HTMLButtonElement>('button.new-event')!;

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Новое событие');
    expect(button.textContent?.trim()).toBe('Событие');
    expect(button.querySelector('tp-icon')?.getAttribute('aria-hidden')).toBe('true');
    button.click();

    expect(open).toHaveBeenCalledOnce();
  });

  it('no «+ Событие» without a workspace', async () => {
    session.setWorkspace(null);
    await fixture.whenStable();

    expect(el().querySelector('button.new-event')).toBeNull();
  });

  it('logo and the section tabs of the prototype, as links', () => {
    expect(el().querySelector('.brand')?.textContent?.trim()).toBe('Together');
    expect(el().querySelector('nav')?.getAttribute('aria-label')).toBe('Разделы');
    expect(tabs().map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Расписание', '/week'],
      ['Календарь', '/calendar'],
      ['Шаблоны', '/templates'],
    ]);
  });

  it('each tab has its icon for the narrow header (SHELL-03) and the label as its name', () => {
    const icon = (a: HTMLAnchorElement) => a.querySelector('tp-icon');
    // `schedule` is a <rect> and one line; `calendar` a <rect> and one path; `layers` is two paths.
    expect(icon(tabs()[0])?.querySelector('rect')).not.toBeNull();
    expect(icon(tabs()[0])?.querySelectorAll('path')).toHaveLength(1);
    expect(icon(tabs()[1])?.querySelector('rect')).not.toBeNull();
    expect(icon(tabs()[1])?.querySelectorAll('path')).toHaveLength(1);
    expect(icon(tabs()[2])?.querySelectorAll('path')).toHaveLength(2);
    expect(tabs().map((a) => a.querySelector('.tab-label')?.textContent)).toEqual([
      'Расписание',
      'Календарь',
      'Шаблоны',
    ]);
    // Decorative: the link keeps the label as its accessible name.
    expect(tabs().map((a) => icon(a)?.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
      'true',
    ]);
  });

  it.each([
    ['/week', 'Расписание'],
    ['/week/2026-11-16', 'Расписание'],
    ['/calendar', 'Календарь'],
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

  it('alone: «+ Пригласить» in place of the second avatar; it goes once the partner joins', async () => {
    session.setWorkspace(WORKSPACE_CREATED);
    await fixture.whenStable();
    expect(invite()?.textContent?.trim()).toBe('Пригласить');
    // The visible caption is part of the name (WCAG 2.5.3); on a narrow screen it is hidden.
    expect(invite()?.getAttribute('aria-label')).toBe('Пригласить партнёра');
    expect(invite()?.type).toBe('button');
    expect(invite()?.querySelector('tp-icon')?.getAttribute('aria-hidden')).toBe('true');
    // After the members, outside the menu button.
    expect(invite()?.previousElementSibling?.tagName.toLowerCase()).toBe('tp-user-menu');

    session.setWorkspace(WORKSPACE_FULL_PAIR);
    await fixture.whenStable();
    expect(invite()).toBeNull();
  });

  it('«Пригласить» opens the invite dialog; no code is issued until «Получить код»', async () => {
    session.setWorkspace(WORKSPACE_CREATED);
    await fixture.whenStable();
    invite()!.click();
    await TestBed.inject(ApplicationRef).whenStable();
    const dialog = dialogElement();
    expect(dialog?.querySelector('h2')?.textContent).toBe('Пригласить партнёра');
    expect(dialog?.querySelector('tp-invite-card')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectNone(
      `/api/v1/workspaces/${WORKSPACE_CREATED.id}/invites`,
    );
  });

  it('the buttons are «+ Событие» and the members one (user menu), in that order', () => {
    const buttons = Array.from(el().querySelectorAll('button'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].classList).toContain('new-event');
    expect(buttons[1].getAttribute('aria-haspopup')).toBe('menu');
  });

  it('without a workspace (session cleared on logout) → no workspace block', async () => {
    session.clear();
    await fixture.whenStable();
    expect(el().querySelector('.workspace')).toBeNull();
    expect(tabs()).toHaveLength(3);
  });
});
