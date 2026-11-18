import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { ProblemDetail } from '@core/api/models/common.models';
import {
  AUTH_RESPONSE,
  ME_WITH_WORKSPACE,
  WORKSPACE_CREATED,
} from '@core/api/models/testing/samples';
import { authInterceptor } from '@core/auth/auth-interceptor';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { BROWSER_TIME_ZONE, CreateWorkspaceForm } from './create-workspace-form';

@Component({
  imports: [CreateWorkspaceForm],
  template: `<tp-create-workspace-form (created)="created = created + 1" />`,
})
class Host {
  created = 0;
}

const URL = '/api/v1/workspaces';
const problem = (status: number, code: ProblemDetail['code'], extra = {}): ProblemDetail => ({
  status,
  title: 'x',
  code,
  ...extra,
});

describe('CreateWorkspaceForm', () => {
  let fixture: ComponentFixture<Host>;
  let backend: HttpTestingController;
  let session: SessionStore;

  function setUp(browserZone: string) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BROWSER_TIME_ZONE, useValue: browserZone },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    fixture = TestBed.createComponent(Host);
    return fixture.whenStable();
  }

  afterEach(() => backend.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const nameInput = () => el().querySelector<HTMLInputElement>('input')!;
  const zone = () => el().querySelector('.zone')?.textContent?.trim();
  const fieldError = () => el().querySelector('tp-form-field .error')?.textContent?.trim() ?? null;
  const formError = () => el().querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  const button = () => el().querySelector<HTMLButtonElement>('button')!;
  const stable = () => fixture.whenStable();

  async function typeName(value: string) {
    nameInput().value = value;
    nameInput().dispatchEvent(new Event('input'));
    await stable();
  }
  async function submit() {
    el()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await stable();
  }

  it('defaults: name «Мы», the browser zone shown, the prototype button', async () => {
    await setUp('Europe/Berlin');
    expect(nameInput().value).toBe('Мы');
    expect(el().querySelector('label')?.textContent).toBe('Название');
    expect(zone()).toBe('Часовой пояс: Europe/Berlin (определён по браузеру)');
    expect(button().textContent?.trim()).toBe('Создать и получить код');
  });

  it('a browser without a zone → Asia/Almaty', async () => {
    await setUp('');
    expect(zone()).toBe('Часовой пояс: Asia/Almaty (определён по браузеру)');
  });

  it('W1 with the trimmed name and the zone → workspace in the session → created', async () => {
    await setUp('Asia/Almaty');
    await typeName('  Мы  ');
    await submit();
    expect(button().getAttribute('aria-busy')).toBe('true');
    await submit(); // ignored while busy
    const req = backend.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Мы', timeZone: 'Asia/Almaty' });
    req.flush(WORKSPACE_CREATED, { status: 201, statusText: 'Created' });
    await stable();
    expect(session.workspace()).toEqual(WORKSPACE_CREATED);
    expect(fixture.componentInstance.created).toBe(1);
    expect(button().getAttribute('aria-busy')).toBeNull();
  });

  it.each([
    ['', 'Заполните поле.'],
    ['   ', 'Заполните поле.'],
    ['я'.repeat(61), 'Не больше 60 символов.'],
  ])('name %j → %s, nothing is sent', async (value, message) => {
    await setUp('Asia/Almaty');
    await typeName(value);
    await submit();
    expect(fieldError()).toBe(message);
    backend.expectNone(URL);
  });

  it('INVALID_TIME_ZONE → Asia/Almaty with a message; the next try sends it', async () => {
    await setUp('Etc/Unknown');
    await submit();
    backend
      .expectOne(URL)
      .flush(problem(400, 'INVALID_TIME_ZONE'), { status: 400, statusText: 'Bad Request' });
    await stable();
    expect(zone()).toBe(
      'Часовой пояс: Asia/Almaty. Пояс браузера не подошёл — проверьте и создайте ещё раз.',
    );
    expect(el().querySelector('.zone')?.getAttribute('role')).toBe('status');
    expect(fixture.componentInstance.created).toBe(0);

    await submit();
    const retry = backend.expectOne(URL);
    expect(retry.request.body).toEqual({ name: 'Мы', timeZone: 'Asia/Almaty' });
    retry.flush(WORKSPACE_CREATED, { status: 201, statusText: 'Created' });
    await stable();
    expect(fixture.componentInstance.created).toBe(1);
  });

  it('ALREADY_IN_WORKSPACE → reload the workspace → /week', async () => {
    await setUp('Asia/Almaty');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await submit();
    backend
      .expectOne(URL)
      .flush(problem(409, 'ALREADY_IN_WORKSPACE'), { status: 409, statusText: 'Conflict' });
    backend.expectOne('/api/v1/auth/me').flush(ME_WITH_WORKSPACE);
    await stable();
    expect(session.workspace()).toEqual(ME_WITH_WORKSPACE.workspace);
    expect(navigate).toHaveBeenCalledWith('/week');
    expect(fixture.componentInstance.created).toBe(0);
  });

  it('ALREADY_IN_WORKSPACE and the reload fails → a toast, no navigation', async () => {
    await setUp('Asia/Almaty');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    await submit();
    backend
      .expectOne(URL)
      .flush(problem(409, 'ALREADY_IN_WORKSPACE'), { status: 409, statusText: 'Conflict' });
    backend.expectOne('/api/v1/auth/me').error(new ProgressEvent('error'));
    await stable();
    expect(TestBed.inject(ToastService).current()?.text).toBe(ERROR_MESSAGES.NETWORK_ERROR);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('VALIDATION_FAILED → the name field and the common message', async () => {
    await setUp('Asia/Almaty');
    await submit();
    backend.expectOne(URL).flush(
      problem(400, 'VALIDATION_FAILED', {
        errors: [{ field: 'name', message: 'не должно быть пустым' }],
      }),
      { status: 400, statusText: 'Bad Request' },
    );
    await stable();
    expect(fieldError()).toBe('Проверьте это поле.');
    expect(formError()).toBe(ERROR_MESSAGES.VALIDATION_FAILED);
  });

  it('a network error → a toast, the form stays', async () => {
    await setUp('Asia/Almaty');
    await submit();
    backend.expectOne(URL).error(new ProgressEvent('error'));
    await stable();
    expect(TestBed.inject(ToastService).current()?.text).toBe(ERROR_MESSAGES.NETWORK_ERROR);
    expect(formError()).toBeNull();
    expect(fixture.componentInstance.created).toBe(0);
  });
});
