import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { ProblemDetail } from '../api/models/common.models';
import {
  AUTH_RESPONSE,
  PROBLEM_INVALID_CREDENTIALS,
  PROBLEM_WORKSPACE_NOT_FOUND,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '../api/models/testing/samples';
import { errorInterceptor } from '../error/error-interceptor';
import { ERROR_MESSAGES } from '../error/error-messages';
import { ToastService } from '../notify/toast-service';
import { authInterceptor } from './auth-interceptor';
import { AuthService } from './auth-service';
import { SessionStore } from './session-store';
import { SessionSync } from './session-sync';

const REFRESH = '/api/v1/auth/refresh';
const W2 = '/api/v1/workspaces/current';
const noWorkspace = { status: 404, statusText: 'Not Found' };

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
    it('refresh → W2 → authenticated with the workspace', async () => {
      const done = firstValueFrom(auth.restore(), { defaultValue: undefined });
      backend.expectOne(REFRESH).flush(AUTH_RESPONSE);
      const w2 = backend.expectOne(W2);
      expect(w2.request.headers.get('Authorization')).toBe(`Bearer ${AUTH_RESPONSE.accessToken}`);
      w2.flush(WORKSPACE_FULL_PAIR);
      await done;
      expect(session.status()).toBe('authenticated');
      expect(session.user()).toEqual(AUTH_RESPONSE.user);
      expect(session.workspace()).toEqual(WORKSPACE_FULL_PAIR);
      expect(toast.current()).toBeNull();
    });

    it('refresh → W2 404 (no workspace yet) → authenticated without one, no toast', async () => {
      const done = firstValueFrom(auth.restore(), { defaultValue: undefined });
      backend.expectOne(REFRESH).flush(AUTH_RESPONSE);
      backend.expectOne(W2).flush(PROBLEM_WORKSPACE_NOT_FOUND, noWorkspace);
      await done;
      expect(session.status()).toBe('authenticated');
      expect(session.hasWorkspace()).toBe(false);
      expect(toast.current()).toBeNull();
    });

    it('refresh 401 (no cookie) → anonymous, no toast, no W2', async () => {
      const done = firstValueFrom(auth.restore(), { defaultValue: undefined });
      backend.expectOne(REFRESH).flush(REFRESH_INVALID, { status: 401, statusText: 'x' });
      backend.expectNone(W2);
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

    it('W2 fails after a good refresh → anonymous and a toast, nothing half-done', async () => {
      const done = firstValueFrom(auth.restore(), { defaultValue: undefined });
      backend.expectOne(REFRESH).flush(AUTH_RESPONSE);
      backend
        .expectOne(W2)
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
  ] as const)('%s → setAuth + W2', async (method, url, status) => {
    const body = { email: 'a@example.test', password: 'secret-123', displayName: 'Даулет' };
    const done = firstValueFrom(auth[method](body), { defaultValue: undefined });
    const req = backend.expectOne(url);
    expect(req.request.body).toEqual(body);
    req.flush(AUTH_RESPONSE, { status, statusText: 'OK' });
    expect(session.status()).toBe('authenticated');
    backend.expectOne(W2).flush(PROBLEM_WORKSPACE_NOT_FOUND, noWorkspace);
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

  describe('logout', () => {
    beforeEach(() => {
      session.setAuth(AUTH_RESPONSE);
      session.setWorkspace(WORKSPACE_CREATED);
    });

    it('AUTH-09: the other tabs are told once the session is cleared', async () => {
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const announce = vi.spyOn(TestBed.inject(SessionSync), 'announceLogout');
      const done = firstValueFrom(auth.logout(), { defaultValue: undefined });
      backend
        .expectOne('/api/v1/auth/logout')
        .flush(null, { status: 204, statusText: 'No Content' });
      await done;
      expect(announce).toHaveBeenCalledTimes(1);
    });

    it('A4 without Bearer → session cleared → /login', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const done = firstValueFrom(auth.logout(), { defaultValue: undefined });
      const req = backend.expectOne('/api/v1/auth/logout');
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.has('Authorization')).toBe(false);
      // Still signed in while the server answers.
      expect(session.isAuthenticated()).toBe(true);
      req.flush(null, { status: 204, statusText: 'No Content' });
      await done;
      expect(session.status()).toBe('anonymous');
      expect(session.workspace()).toBeNull();
      expect(session.accessToken()).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/login');
    });

    it.each([
      ['network down', (r: TestRequest) => r.error(new ProgressEvent('error'))],
      [
        'server error',
        (r: TestRequest) =>
          r.flush(
            { status: 500, title: 'x', code: 'INTERNAL_ERROR' },
            { status: 500, statusText: 'x' },
          ),
      ],
    ])('%s does not keep the user signed in here', async (_, fail) => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const result = settle(firstValueFrom(auth.logout(), { defaultValue: undefined }));
      fail(backend.expectOne('/api/v1/auth/logout'));
      expect(await result).toBe('done');
      expect(session.status()).toBe('anonymous');
      expect(navigate).toHaveBeenCalledWith('/login');
      expect(toast.current()).toBeNull();
    });
  });

  describe('logoutAll (SET-02)', () => {
    beforeEach(() => {
      session.setAuth(AUTH_RESPONSE);
      session.setWorkspace(WORKSPACE_CREATED);
    });

    it('A5 with Bearer → session cleared → /login', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const done = firstValueFrom(auth.logoutAll(), { defaultValue: undefined });
      const req = backend.expectOne('/api/v1/auth/logout-all');
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${AUTH_RESPONSE.accessToken}`);
      // Still signed in while the server answers.
      expect(session.isAuthenticated()).toBe(true);
      req.flush(null, { status: 204, statusText: 'No Content' });
      await done;
      expect(session.status()).toBe('anonymous');
      expect(session.workspace()).toBeNull();
      expect(session.accessToken()).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/login');
    });

    it.each([
      ['network down', (r: TestRequest) => r.error(new ProgressEvent('error'))],
      [
        'server error',
        (r: TestRequest) =>
          r.flush(
            { status: 500, title: 'x', code: 'INTERNAL_ERROR' },
            { status: 500, statusText: 'x' },
          ),
      ],
    ])('%s: the error goes to the caller and the user stays signed in', async (_, fail) => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const result = firstValueFrom(auth.logoutAll(), { defaultValue: undefined }).then(
        () => 'done',
        (error: unknown) => error,
      );
      fail(backend.expectOne('/api/v1/auth/logout-all'));
      expect(await result).toBeTruthy();
      expect(await result).not.toBe('done');
      expect(session.status()).toBe('authenticated');
      expect(session.workspace()).not.toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('reloadWorkspace (WS-07)', () => {
    beforeEach(() => {
      session.setAuth(AUTH_RESPONSE);
      session.setWorkspace(WORKSPACE_CREATED);
    });

    it('W2 → the current workspace into the session and to the caller', async () => {
      const done = firstValueFrom(auth.reloadWorkspace());
      const req = backend.expectOne(W2);
      expect(req.request.method).toBe('GET');
      req.flush(WORKSPACE_FULL_PAIR);
      expect(await done).toEqual(WORKSPACE_FULL_PAIR);
      expect(session.partner()?.displayName).toBe(WORKSPACE_FULL_PAIR.members[1].displayName);
    });

    it('404 WORKSPACE_NOT_FOUND → null in the session, not an error', async () => {
      const done = firstValueFrom(auth.reloadWorkspace());
      backend.expectOne(W2).flush(PROBLEM_WORKSPACE_NOT_FOUND, noWorkspace);
      expect(await done).toBeNull();
      expect(session.workspace()).toBeNull();
    });

    it('another error → to the caller; the session keeps its workspace', async () => {
      const result = settle(firstValueFrom(auth.reloadWorkspace()));
      backend.expectOne(W2).error(new ProgressEvent('error'));
      expect(await result).toMatchObject({ code: 'NETWORK_ERROR' });
      expect(session.workspace()).toEqual(WORKSPACE_CREATED);
    });
  });
});
