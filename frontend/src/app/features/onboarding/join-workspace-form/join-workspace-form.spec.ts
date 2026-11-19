import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { ProblemDetail } from '@core/api/models/common.models';
import { AUTH_RESPONSE, WORKSPACE_FULL_PAIR } from '@core/api/models/testing/samples';
import { authInterceptor } from '@core/auth/auth-interceptor';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { JoinWorkspaceForm } from './join-workspace-form';

const URL = '/api/v1/workspaces/join';
const problem = (status: number, code: ProblemDetail['code'], extra = {}): ProblemDetail => ({
  status,
  title: 'x',
  code,
  ...extra,
});

describe('JoinWorkspaceForm', () => {
  let fixture: ComponentFixture<JoinWorkspaceForm>;
  let backend: HttpTestingController;
  let session: SessionStore;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(JoinWorkspaceForm);
    await stable();
  });

  afterEach(() => backend.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector<HTMLInputElement>('input')!;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.trim() ?? null;
  const button = () => el().querySelector<HTMLButtonElement>('button')!;
  const stable = () => fixture.whenStable();

  async function type(value: string) {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await stable();
  }
  async function submit() {
    el()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await stable();
  }
  async function failWith(status: number, code: ProblemDetail['code'], extra = {}) {
    backend.expectOne(URL).flush(problem(status, code, extra), { status, statusText: 'x' });
    await stable();
  }

  it('shows the prototype field: label, hint, placeholder and «Присоединиться»', () => {
    expect(text('label')).toBe('Код приглашения');
    expect(text('.hint')).toBe('Код из 8 символов, например K7Q2-M9XD');
    expect(input().placeholder).toBe('XXXX-XXXX');
    expect(input().getAttribute('aria-describedby')).toContain('hint');
    expect(button().textContent?.trim()).toBe('Присоединиться');
  });

  it('the `code` input fills the field and sends nothing by itself', async () => {
    // A fresh instance: the input is read once, when the form starts.
    const prefilled = TestBed.createComponent(JoinWorkspaceForm);
    prefilled.componentRef.setInput('code', 'ACZ9AXJN');
    await prefilled.whenStable();
    const field = (prefilled.nativeElement as HTMLElement).querySelector('input')!;
    expect(field.value).toBe('ACZ9AXJN');
    backend.expectNone(URL);
  });

  it('W6 with the code as typed (trimmed) → the workspace in the session → /week', async () => {
    await type('  acz9-axjn ');
    await submit();
    expect(button().getAttribute('aria-busy')).toBe('true');
    await submit(); // ignored while busy
    const req = backend.expectOne(URL);
    expect(req.request.method).toBe('POST');
    // Case and the dash are left as they are: the backend normalizes the code.
    expect(req.request.body).toEqual({ code: 'acz9-axjn' });
    req.flush(WORKSPACE_FULL_PAIR);
    await stable();
    expect(session.workspace()).toEqual(WORKSPACE_FULL_PAIR);
    expect(navigate).toHaveBeenCalledWith('/week');
    expect(button().getAttribute('aria-busy')).toBeNull();
  });

  it.each(['', '   '])('code %j → «Заполните поле.», nothing is sent', async (value) => {
    await type(value);
    await submit();
    expect(text('.error')).toBe('Заполните поле.');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    backend.expectNone(URL);
  });

  it.each([
    [404, 'INVITE_NOT_FOUND'],
    [409, 'INVITE_EXPIRED'],
    [409, 'INVITE_ALREADY_USED'],
    [409, 'WORKSPACE_FULL'],
    [409, 'ALREADY_IN_WORKSPACE'],
  ] as const)('%i %s → its text at the field; editing clears it', async (status, code) => {
    await type('K7Q2-M9XD');
    await submit();
    await failWith(status, code);
    expect(text('.error')).toBe(ERROR_MESSAGES[code]);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(text('[role="alert"]')).toBeNull();
    expect(TestBed.inject(ToastService).current()).toBeNull();
    expect(session.workspace()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();

    await type('K7Q2-M9XE');
    expect(text('.error')).toBeNull();
  });

  it('VALIDATION_FAILED → the field and the common message', async () => {
    await type('K'.repeat(21));
    await submit();
    await failWith(400, 'VALIDATION_FAILED', {
      errors: [{ field: 'code', message: 'размер должен находиться в диапазоне от 0 до 20' }],
    });
    expect(text('.error')).toBe('Проверьте это поле.');
    expect(text('[role="alert"]')).toBe(ERROR_MESSAGES.VALIDATION_FAILED);
  });

  it('a network error → a toast, the form stays as it was', async () => {
    await type('K7Q2-M9XD');
    await submit();
    backend.expectOne(URL).error(new ProgressEvent('error'));
    await stable();
    expect(TestBed.inject(ToastService).current()?.text).toBe(ERROR_MESSAGES.NETWORK_ERROR);
    expect(text('.error')).toBeNull();
    expect(input().value).toBe('K7Q2-M9XD');
    expect(navigate).not.toHaveBeenCalled();
  });
});
