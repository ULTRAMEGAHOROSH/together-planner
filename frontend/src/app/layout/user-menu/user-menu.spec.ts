import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  AUTH_RESPONSE,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { authInterceptor } from '@core/auth/auth-interceptor';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { dialogElement, provideVisibleElements } from '@shared/ui/dialog/testing';
import { UserMenu } from './user-menu';

const INVITES = `/api/v1/workspaces/${WORKSPACE_CREATED.id}/invites`;
// CDK Menu reads the legacy `keyCode`, so the events carry it next to `key`.
const KEY_CODES: Record<string, number> = { Enter: 13, Escape: 27, ArrowDown: 40 };

describe('UserMenu (SHELL-02)', () => {
  let fixture: ComponentFixture<UserMenu>;
  let backend: HttpTestingController;
  let session: SessionStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideVisibleElements(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_CREATED);
    fixture = TestBed.createComponent(UserMenu);
    await stable();
  });

  afterEach(() => {
    backend.verify();
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  const stable = () => TestBed.inject(ApplicationRef).whenStable();
  const trigger = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.trigger')!;
  const menu = () => document.querySelector<HTMLElement>('tp-menu');
  const items = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[tpMenuItem]'));
  const labels = () => items().map((b) => b.textContent?.trim());
  const item = (label: string) => items().find((b) => b.textContent?.trim() === label)!;
  async function key(target: Element, name: string) {
    const init = { key: name, keyCode: KEY_CODES[name], bubbles: true, cancelable: true };
    target.dispatchEvent(new KeyboardEvent('keydown', init));
    await stable();
  }
  async function open() {
    trigger().click();
    await stable();
  }

  it('the button shows the members and names them; it opens a menu', async () => {
    expect(trigger().querySelector('tp-avatar')?.textContent).toBe('Д');
    expect(trigger().querySelector('.member-name')?.textContent).toBe('Даулет');
    expect(trigger().getAttribute('aria-label')).toBe('Меню: Даулет');
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    await open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('the menu: who is signed in (its name), «Настройки», «Пригласить по коду» while alone, «Выйти»', async () => {
    await open();
    const head = document.getElementById(menu()!.getAttribute('aria-labelledby')!);
    expect(head?.querySelector('.name')?.textContent).toBe(AUTH_RESPONSE.user.displayName);
    expect(head?.querySelector('.email')?.textContent).toBe(AUTH_RESPONSE.user.email);
    expect(labels()).toEqual(['Настройки', 'Пригласить по коду', 'Выйти']);
    expect(item('Выйти').classList).toContain('danger');
  });

  it('no user in the session (signed out in another tab) → no header, the items stay', async () => {
    session.clear();
    await stable();
    await open();
    expect(menu()?.querySelector('.head')).toBeNull();
    expect(labels()).toEqual(['Настройки', 'Выйти']);
  });

  it('with the partner in the workspace there is nothing to invite to', async () => {
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    await stable();
    expect(trigger().getAttribute('aria-label')).toBe('Меню: Даулет Партнёр');
    await open();
    expect(labels()).toEqual(['Настройки', 'Выйти']);
  });

  it('keyboard: ↓ opens on the first item, ↓ moves, Enter on «Выйти» → A4 → /login', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    trigger().focus();
    await key(trigger(), 'ArrowDown');
    expect(document.activeElement).toBe(item('Настройки'));
    await key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(item('Пригласить по коду'));
    await key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(item('Выйти'));
    await key(document.activeElement!, 'Enter');
    expect(menu()).toBeNull();

    backend.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await stable();
    expect(session.status()).toBe('anonymous');
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('«Настройки» → the settings page, the menu closes', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await open();
    item('Настройки').click();
    await stable();
    expect(menu()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/settings');
  });

  it('Esc closes the menu and gives the focus back to the button', async () => {
    trigger().focus();
    await key(trigger(), 'ArrowDown');
    await key(document.activeElement!, 'Escape');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('«Пригласить по коду» → the dialog with the card; no code until «Получить код»', async () => {
    await open();
    item('Пригласить по коду').click();
    await stable();
    expect(menu()).toBeNull();
    const dialog = dialogElement()!;
    expect(dialog.querySelector('h2')?.textContent).toBe('Пригласить партнёра');
    expect(dialog.querySelector('tp-invite-card')).not.toBeNull();
    backend.expectNone(INVITES);

    const button = (label: string) =>
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;
    button('Получить код').click();
    await stable();
    backend
      .expectOne(INVITES)
      .flush(
        { code: 'ACZ9AXJN', displayCode: 'ACZ9-AXJN', expiresAt: '2026-11-24T11:06:00Z' },
        { status: 201, statusText: 'Created' },
      );
    await stable();
    expect(dialog.querySelector('.code')?.textContent).toBe('ACZ9-AXJN');

    button('Готово').click();
    await stable();
    expect(dialogElement()).toBeNull();
  });
});
