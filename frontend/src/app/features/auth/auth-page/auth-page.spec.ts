import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { ProblemDetail } from '@core/api/models/common.models';
import {
  AUTH_RESPONSE,
  ME_WITHOUT_WORKSPACE,
  PROBLEM_INVALID_CREDENTIALS,
  PROBLEM_VALIDATION,
} from '@core/api/models/testing/samples';
import { authInterceptor } from '@core/auth/auth-interceptor';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { AuthPage } from './auth-page';

@Component({ template: 'target' })
class Target {}

const problem = (status: number, code: ProblemDetail['code']): ProblemDetail => ({
  status,
  title: 'x',
  code,
});

describe('AuthPage', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: 'login', component: AuthPage, data: { mode: 'login' } },
            { path: 'register', component: AuthPage, data: { mode: 'register' } },
            { path: 'week', component: Target },
            { path: 'join', component: Target },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => backend.verify());

  const page = () => harness.routeNativeElement as HTMLElement;
  const input = (name: string) =>
    page().querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
  const submitButton = () => page().querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const errorOf = (name: string) =>
    input(name).closest('tp-form-field')?.querySelector('.error')?.textContent?.trim() ?? null;
  const formError = () => page().querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  const url = () => TestBed.inject(Router).url;
  const stable = () => harness.fixture.whenStable();

  async function type(name: string, value: string) {
    input(name).value = value;
    input(name).dispatchEvent(new Event('input'));
    await stable();
  }
  async function blur(name: string) {
    input(name).dispatchEvent(new Event('blur'));
    await stable();
  }
  /** What Enter in a field or a click on the submit button does: the form's submit event. */
  async function submit() {
    page()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await stable();
  }
  async function fillLogin() {
    await type('email', 'a@example.test');
    await type('password', 'secret-123');
  }

  it('login: email and password with autocomplete, the tab is chosen by the path', async () => {
    await harness.navigateByUrl('/login');
    expect(input('displayName')).toBeNull();
    expect(input('email').getAttribute('autocomplete')).toBe('email');
    expect(input('email').type).toBe('email');
    expect(input('password').getAttribute('autocomplete')).toBe('current-password');
    expect(submitButton().textContent?.trim()).toBe('Войти');
    const checked = page().querySelector('[role="radio"][aria-checked="true"]');
    expect(checked?.textContent?.trim()).toBe('Вход');
    expect(page().querySelector('label[for]')?.textContent).toBe('Email');
  });

  it('register: the name field, new-password and its own button', async () => {
    await harness.navigateByUrl('/register');
    expect(input('displayName').getAttribute('autocomplete')).toBe('name');
    expect(input('password').getAttribute('autocomplete')).toBe('new-password');
    expect(submitButton().textContent?.trim()).toBe('Создать аккаунт');
    expect(page().textContent).toContain('После регистрации создайте пространство');
  });

  it('a tab switches the path and keeps returnUrl', async () => {
    await harness.navigateByUrl('/login?returnUrl=%2Fjoin%3Fcode%3DK7QM2XPA');
    page().querySelectorAll<HTMLButtonElement>('[role="radio"]')[1].click();
    await stable();
    expect(url()).toBe('/register?returnUrl=%2Fjoin%3Fcode%3DK7QM2XPA');
    expect(input('displayName')).not.toBeNull();
  });

  it('errors appear after leaving the field or after a submit, and nothing is sent', async () => {
    await harness.navigateByUrl('/register');
    await type('password', '123');
    expect(errorOf('password')).toBeNull();
    await blur('password');
    expect(errorOf('password')).toBe('Минимум 8 символов.');
    expect(input('password').getAttribute('aria-invalid')).toBe('true');
    expect(errorOf('email')).toBeNull();

    await submit();
    expect(errorOf('displayName')).toBe('Заполните поле.');
    expect(errorOf('email')).toBe('Заполните поле.');
    backend.expectNone(() => true);

    await type('password', 'я'.repeat(40));
    expect(errorOf('password')).toBe('Слишком длинный текст.');
  });

  it('login → trimmed request, me, then returnUrl', async () => {
    await harness.navigateByUrl('/login?returnUrl=%2Fjoin%3Fcode%3DK7QM2XPA');
    await type('email', '  a@example.test ');
    await type('password', ' secret-123');
    await submit();
    const login = backend.expectOne('/api/v1/auth/login');
    expect(login.request.body).toEqual({ email: 'a@example.test', password: ' secret-123' });
    login.flush(AUTH_RESPONSE);
    backend.expectOne('/api/v1/auth/me').flush(ME_WITHOUT_WORKSPACE);
    await stable();
    expect(url()).toBe('/join?code=K7QM2XPA');
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
  });

  it.each([
    ['without returnUrl', '/register'],
    ['with an unsafe returnUrl (DoD)', '/register?returnUrl=%2F%2Fevil.test'],
  ])('register %s → /week', async (_, path) => {
    await harness.navigateByUrl(path);
    await type('displayName', ' Даулет ');
    await fillLogin();
    await submit();
    const register = backend.expectOne('/api/v1/auth/register');
    expect(register.request.body).toEqual({
      email: 'a@example.test',
      password: 'secret-123',
      displayName: 'Даулет',
    });
    register.flush(AUTH_RESPONSE, { status: 201, statusText: 'Created' });
    backend.expectOne('/api/v1/auth/me').flush(ME_WITHOUT_WORKSPACE);
    await stable();
    expect(url()).toBe('/week');
  });

  it('while the request runs the button is busy and a second submit sends nothing', async () => {
    await harness.navigateByUrl('/login');
    await fillLogin();
    await submit();
    expect(submitButton().classList).toContain('loading');
    expect(submitButton().getAttribute('aria-busy')).toBe('true');
    await submit();
    backend.expectOne('/api/v1/auth/login').flush(PROBLEM_INVALID_CREDENTIALS, {
      status: 401,
      statusText: 'Unauthorized',
    });
    await stable();
    expect(submitButton().classList).not.toContain('loading');
  });

  it('INVALID_CREDENTIALS → message under the form, gone after an edit', async () => {
    await harness.navigateByUrl('/login');
    await fillLogin();
    await submit();
    backend
      .expectOne('/api/v1/auth/login')
      .flush(PROBLEM_INVALID_CREDENTIALS, { status: 401, statusText: 'Unauthorized' });
    await stable();
    expect(formError()).toBe('Неверный email или пароль.');
    expect(url()).toBe('/login');
    await type('password', 'another-pass');
    expect(formError()).toBeNull();
  });

  it.each([
    ['EMAIL_ALREADY_REGISTERED', 409, 'email', 'Этот email уже зарегистрирован.'],
    ['PASSWORD_TOO_LONG', 400, 'password', 'Пароль слишком длинный.'],
  ] as const)('%s → under the %s field', async (code, status, field, message) => {
    await harness.navigateByUrl('/register');
    await type('displayName', 'Даулет');
    await fillLogin();
    await submit();
    backend
      .expectOne('/api/v1/auth/register')
      .flush(problem(status, code), { status, statusText: 'x' });
    await stable();
    expect(errorOf(field)).toBe(message);
    expect(input(field).getAttribute('aria-invalid')).toBe('true');
    expect(formError()).toBeNull();
  });

  it('VALIDATION_FAILED → the named fields and the common message', async () => {
    await harness.navigateByUrl('/register');
    await type('displayName', 'Даулет');
    await fillLogin();
    await submit();
    backend
      .expectOne('/api/v1/auth/register')
      .flush(PROBLEM_VALIDATION, { status: 400, statusText: 'Bad Request' });
    await stable();
    expect(errorOf('email')).toBe('Проверьте это поле.');
    expect(formError()).toBe(ERROR_MESSAGES.VALIDATION_FAILED);
  });

  it('a network error → a toast, the form stays as it was', async () => {
    await harness.navigateByUrl('/login');
    await fillLogin();
    await submit();
    backend.expectOne('/api/v1/auth/login').error(new ProgressEvent('error'));
    await stable();
    expect(TestBed.inject(ToastService).current()?.text).toBe(ERROR_MESSAGES.NETWORK_ERROR);
    expect(formError()).toBeNull();
    expect(errorOf('email')).toBeNull();
    expect(submitButton().classList).not.toContain('loading');
  });
});
