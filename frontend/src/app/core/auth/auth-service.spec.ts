import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { ProblemDetail } from '../api/models/common.models';
import {
  AUTH_RESPONSE,
  ME_WITH_WORKSPACE,
  ME_WITHOUT_WORKSPACE,
  PROBLEM_INVALID_CREDENTIALS,
} from '../api/models/testing/samples';
import { errorInterceptor } from '../error/error-interceptor';
import { ERROR_MESSAGES } from '../error/error-messages';
import { ToastService } from '../notify/toast-service';
import { authInterceptor } from './auth-interceptor';
import { AuthService } from './auth-service';
import { SessionStore } from './session-store';

const REFRESH = '/api/v1/auth/refresh';
const ME = '/api/v1/auth/me';

const REFRESH_INVALID = {
  detail: 'Missing refresh token cookie',
  instance: REFRESH,
  status: 401,
  title: 'Unauthorized',
  code: 'REFRESH_TOKEN_INVALID',
} satisfies ProblemDetail;

describe('AuthService', () => {
  let auth: AuthService;
  let session: SessionStore;
  let toast: ToastService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    auth = TestBed.inject(AuthService);
    session = TestBed.inject(SessionStore);
    toast = TestBed.inject(ToastService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const settle = (promise: Promise<unknown>) =>
    promise.then(
      () => 'done',
      (error: unknown) => error,
    );

  describe('restore', () => {
    it('refresh → me → authenticated with the workspace', async () => {
      const done = firstValueFrom(auth.restore(), { defaultValue: undefined });
      backend.expectOne(REFRESH).flush(AUTH_RESPONSE);
      const me = backend.expectOne(ME);
      expect(me.request.headers.get('Authorization')).toBe(`Bearer ${AUTH_RESPONSE.accessToken}`);
      me.flush(ME_WITH_WORKSPACE);
      await done;
      expect(session.status()).toBe('authenticated');
      expect(session.user()).toEqual(AUTH_RESPONSE.user);
      expect(session.workspace()).toEqual(ME_WITH_WORKSPACE.workspace);
      expect(toast.current()).toBeNull();
    });

    it('refresh 401 (no cookie) → anonymous, no toast, no /me', async () => {
      const done = firstValueFrom(auth.restore(), { defaultValue: undefined });
      backend.expectOne(REFRESH).flush(REFRESH_INVALID, { status: 401, statusText: 'x' });
      backend.expectNone(ME);
      await done;
      expect(session.status()).toBe('anonymous');
      expect(toast.current()).toBeNull();
    });

    it('network down → anonymous and a toast; the app still starts', async () => {
      const done = settle(firstValueFrom(auth.restore(), { defaultValue: undefined }));
      backend.expectOne(REFRESH).error(new ProgressEvent('error'));
      expect(await done).toBe('done');
      expect(session.status()).toBe('anonymous');
      expect(toast.current()?.text).toBe(ERROR_MESSAGES.NETWORK_ERROR);
    });

    it('me fails after a good refresh → anonymous and a toast, nothing half-done', async () => {
      const done = firstValueFrom(auth.restore(), { defaultValue: undefined });
      backend.expectOne(REFRESH).flush(AUTH_RESPONSE);
      backend
        .expectOne(ME)
        .flush(
          { status: 500, title: 'x', code: 'INTERNAL_ERROR' },
          { status: 500, statusText: 'x' },
        );
      await done;
      expect(session.status()).toBe('anonymous');
      expect(session.user()).toBeNull();
      expect(toast.current()?.text).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });
  });

  it.each([
    ['login', '/api/v1/auth/login', 200],
    ['register', '/api/v1/auth/register', 201],
  ] as const)('%s → setAuth + me', async (method, url, status) => {
    const body = { email: 'a@example.test', password: 'secret-123', displayName: 'Даулет' };
    const done = firstValueFrom(auth[method](body), { defaultValue: undefined });
    const req = backend.expectOne(url);
    expect(req.request.body).toEqual(body);
    req.flush(AUTH_RESPONSE, { status, statusText: 'OK' });
    expect(session.status()).toBe('authenticated');
    backend.expectOne(ME).flush(ME_WITHOUT_WORKSPACE);
    await done;
    expect(session.accessToken()).toBe(AUTH_RESPONSE.accessToken);
    expect(session.hasWorkspace()).toBe(false);
  });

  it('login error goes to the caller, the session is not touched', async () => {
    const result = settle(
      firstValueFrom(auth.login({ email: 'a@example.test', password: 'wrong-pass' })),
    );
    backend
      .expectOne('/api/v1/auth/login')
      .flush(PROBLEM_INVALID_CREDENTIALS, { status: 401, statusText: 'x' });
    expect(await result).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(session.status()).toBe('unknown');
    expect(toast.current()).toBeNull();
  });

  it('reloadWorkspace puts the current workspace (or null) into the session', async () => {
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(ME_WITH_WORKSPACE.workspace);
    const done = firstValueFrom(auth.reloadWorkspace(), { defaultValue: undefined });
    backend.expectOne(ME).flush(ME_WITHOUT_WORKSPACE);
    await done;
    expect(session.workspace()).toBeNull();
  });
});
