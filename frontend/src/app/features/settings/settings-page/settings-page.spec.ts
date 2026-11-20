import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  AUTH_RESPONSE,
  PROBLEM_MALFORMED,
  PROBLEM_VALIDATION,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { dialogElement, provideVisibleElements } from '@shared/ui/dialog/testing';
import { SettingsPage } from './settings-page';

const WORKSPACE = `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}`;

describe('SettingsPage (SET-01)', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let backend: HttpTestingController;
  let session: SessionStore;
  const toastShow = vi.fn();
  const toastError = vi.fn();

  const stable = () => TestBed.inject(ApplicationRef).whenStable();
  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector<HTMLInputElement>('input')!;
  const save = () =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Сохранить',
    )!;
  const facts = (section: string) =>
    Array.from(el().querySelectorAll(`[aria-labelledby="${section}"] .facts > div`)).map((row) => [
      row.querySelector('dt')?.textContent,
      row.querySelector('dd')?.textContent,
    ]);
  async function open(workspace = WORKSPACE_FULL_PAIR) {
    session.setWorkspace(workspace);
    fixture = TestBed.createComponent(SettingsPage);
    await stable();
  }
  async function type(text: string) {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    await stable();
  }

  beforeEach(() => {
    toastShow.mockClear();
    toastError.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideVisibleElements(),
        { provide: ToastService, useValue: { show: toastShow, error: toastError } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
  });

  afterEach(() => {
    backend.verify();
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  it('the profile is read-only: name, email and the date since which the user is with us', async () => {
    await open();
    expect(facts('settings-profile')).toEqual([
      ['Имя', AUTH_RESPONSE.user.displayName],
      ['Email', AUTH_RESPONSE.user.email],
      ['С нами с', '17 ноября 2026'],
    ]);
    // The only field of the page is the name of the workspace: nothing to edit in the profile.
    expect(el().querySelectorAll('input')).toHaveLength(1);
    expect(el().querySelector('[aria-labelledby="settings-profile"] input')).toBeNull();
    expect(el().querySelector('[aria-labelledby="settings-profile"] .note')?.textContent).toContain(
      'нельзя изменить',
    );
  });

  it('the time zone is shown as text, not as a field (OQ-1)', async () => {
    await open();
    expect(facts('settings-workspace')).toEqual([['Часовой пояс', 'Asia/Almaty']]);
    expect(el().querySelector('select')).toBeNull();
  });

  it('the members by seat, with their roles and the date they joined', async () => {
    await open();
    const rows = Array.from(el().querySelectorAll('.member')).map((m) => [
      m.querySelector('.member-name')?.textContent,
      m.querySelector('.member-meta')?.textContent?.replace(/\s+/g, ' ').trim(),
    ]);
    expect(rows).toEqual([
      ['Даулет', 'Создатель · с 17 ноября 2026'],
      ['Партнёр', 'Участник · с 17 ноября 2026'],
    ]);
    backend.expectNone(() => true); // the members come with the workspace, no W4
  });

  it('the invite card only while the partner has not joined, and without asking for a code', async () => {
    await open(WORKSPACE_CREATED);
    expect(el().querySelector('tp-invite-card')).not.toBeNull();
    backend.expectNone(() => true);
    await open(WORKSPACE_FULL_PAIR);
    expect(el().querySelector('tp-invite-card')).toBeNull();
  });

  it('the form has the name of the workspace; «Сохранить» waits for a change', async () => {
    await open();
    expect(input().value).toBe('Мы');
    expect(save().disabled).toBe(true);
    await type('Дом');
    expect(save().disabled).toBe(false);
    await type('  Мы ');
    expect(save().disabled).toBe(true);
  });

  it('rename: W3 with the trimmed name, the session (and the header) gets the new one', async () => {
    await open();
    await type('  Наш дом ');
    save().click();
    const request = backend.expectOne(WORKSPACE);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Наш дом' });
    request.flush({ ...WORKSPACE_FULL_PAIR, name: 'Наш дом' });
    await stable();

    expect(session.workspace()?.name).toBe('Наш дом');
    expect(input().value).toBe('Наш дом');
    expect(save().disabled).toBe(true);
    expect(toastShow).toHaveBeenCalledExactlyOnceWith('Название сохранено');
  });

  it('a blank name: the message at the field, no request', async () => {
    await open();
    await type('   ');
    save().click();
    await stable();
    expect(el().querySelector('.error, [role="alert"]')?.textContent).toContain('Заполните');
    backend.expectNone(() => true);
  });

  it('a name over the limit is refused on the screen too', async () => {
    await open();
    await type('я'.repeat(61));
    save().click();
    await stable();
    backend.expectNone(() => true);
    expect(session.workspace()?.name).toBe('Мы');
  });

  it('one request at a time: a second click while W3 runs sends nothing', async () => {
    await open();
    await type('Дом');
    save().click();
    save().click();
    backend.expectOne(WORKSPACE).flush({ ...WORKSPACE_FULL_PAIR, name: 'Дом' });
  });

  it('VALIDATION_FAILED: the message at the name and under the form; the old name stays', async () => {
    await open();
    await type('Дом');
    save().click();
    backend
      .expectOne(WORKSPACE)
      .flush(
        { ...PROBLEM_VALIDATION, errors: [{ field: 'name', message: 'bad' }] },
        { status: 400, statusText: 'Bad Request' },
      );
    await stable();
    expect(el().querySelector('.form-error')?.textContent).toContain(
      ERROR_MESSAGES.VALIDATION_FAILED,
    );
    expect(session.workspace()?.name).toBe('Мы');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('any other error goes to a toast and the form stays as it was typed', async () => {
    await open();
    await type('Дом');
    save().click();
    backend.expectOne(WORKSPACE).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
    await stable();
    expect(toastError).toHaveBeenCalledOnce();
    expect(input().value).toBe('Дом');
    expect(save().disabled).toBe(false);
  });

  describe('sign out everywhere (SET-02)', () => {
    const LOGOUT_ALL = '/api/v1/auth/logout-all';
    const leave = () =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.trim() === 'Выйти на всех устройствах',
      )!;
    const dialogButton = (label: string) =>
      Array.from(dialogElement()!.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label,
      )!;

    it('the button asks first: what happens, and that tokens already issued live for a while', async () => {
      await open();
      leave().click();
      await stable();
      const dialog = dialogElement()!;
      expect(dialog.querySelector('h2')?.textContent).toBe('Выйти на всех устройствах?');
      expect(dialog.textContent).toContain('до 15 минут');
      expect(dialog.textContent).toContain('войти заново');
      backend.expectNone(LOGOUT_ALL);
    });

    it('«Отмена»: nothing is sent, the user stays', async () => {
      await open();
      leave().click();
      await stable();
      dialogButton('Отмена').click();
      await stable();
      expect(dialogElement()).toBeNull();
      backend.expectNone(LOGOUT_ALL);
      expect(session.isAuthenticated()).toBe(true);
    });

    it('«Выйти везде»: A5, then signed out here and sent to /login', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      await open();
      leave().click();
      await stable();
      dialogButton('Выйти везде').click();
      await stable();
      const request = backend.expectOne(LOGOUT_ALL);
      expect(request.request.method).toBe('POST');
      expect(leave().getAttribute('aria-busy')).toBe('true'); // waits for the answer
      request.flush(null, { status: 204, statusText: 'No Content' });
      await stable();
      expect(session.status()).toBe('anonymous');
      expect(navigate).toHaveBeenCalledWith('/login');
    });

    it('A5 fails: the user is told and stays signed in, the button works again', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      await open();
      leave().click();
      await stable();
      dialogButton('Выйти везде').click();
      await stable();
      backend.expectOne(LOGOUT_ALL).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
      await stable();
      expect(toastError).toHaveBeenCalledOnce();
      expect(session.isAuthenticated()).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
      expect(leave().getAttribute('aria-busy')).toBeNull();
    });
  });

  it('no workspace in the session: only the profile', async () => {
    session.setWorkspace(null);
    fixture = TestBed.createComponent(SettingsPage);
    await stable();
    expect(el().querySelector('[aria-labelledby="settings-workspace"]')).toBeNull();
    expect(el().querySelector('[aria-labelledby="settings-profile"]')).not.toBeNull();
  });
});
