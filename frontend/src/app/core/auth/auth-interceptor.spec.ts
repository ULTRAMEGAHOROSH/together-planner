import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, retry } from 'rxjs';
import type { ProblemDetail } from '../api/models/common.models';
import {
  AUTH_RESPONSE,
  PROBLEM_INVALID_CREDENTIALS,
  PROBLEM_UNAUTHORIZED,
} from '../api/models/testing/samples';
import { ApiError } from '../error/api-error';
import { errorInterceptor } from '../error/error-interceptor';
import { ToastService } from '../notify/toast-service';
import { CLOCK } from '../time/zone-clock';
import { authInterceptor, RETRIED } from './auth-interceptor';
import { SessionStore } from './session-store';

const OLD = 'eyJ.old.sample';
const NEW = 'eyJ.new.sample';
const WEEK = '/api/v1/workspaces/ws-1/week';
const REFRESH = '/api/v1/auth/refresh';

const REFRESH_INVALID = {
  detail: 'Unknown refresh token',
  instance: REFRESH,
  status: 401,
  title: 'Unauthorized',
  code: 'REFRESH_TOKEN_INVALID',
} satisfies ProblemDetail;

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionStore;
  let toast: ToastService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // The order of app.config.ts.
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CLOCK, useValue: () => Date.UTC(2026, 10, 18, 9, 0) },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    toast = TestBed.inject(ToastService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/week/2026-11-16?day=2026-11-18');
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    session.setAuth({ ...AUTH_RESPONSE, accessToken: OLD });
  });

  afterEach(() => backend.verify());

  const settle = <T>(promise: Promise<T>) => promise.catch((error: unknown) => error);
  const unauthorized = (req: TestRequest) =>
    req.flush(PROBLEM_UNAUTHORIZED, { status: 401, statusText: 'Unauthorized' });
  const bearerOf = (req: TestRequest) => req.request.headers.get('Authorization');
  const refreshOk = () => backend.expectOne(REFRESH).flush({ ...AUTH_RESPONSE, accessToken: NEW });

  it('AI-01: a protected request carries the Bearer token', () => {
    http.get(WEEK).subscribe();
    const req = backend.expectOne(WEEK);
    expect(bearerOf(req)).toBe(`Bearer ${OLD}`);
    req.flush({});
  });

  it.each(['register', 'login', 'refresh', 'logout'])(
    'AI-02: POST /auth/%s goes without Authorization',
    (path) => {
      http.post(`/api/v1/auth/${path}`, null).subscribe();
      const req = backend.expectOne(`/api/v1/auth/${path}`);
      expect(req.request.headers.has('Authorization')).toBe(false);
      expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
      req.flush({});
    },
  );

  it('AI-03: every API request gets X-Requested-With, also without a session', () => {
    session.clear();
    http.get(WEEK).subscribe();
    http.get('/api/v1/auth/me').subscribe();
    for (const req of backend.match(() => true)) {
      expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    }
  });

  it('a request outside the API gets neither header', () => {
    http.get('/assets/logo.svg').subscribe();
    http.get('https://example.test/api/v1/x').subscribe();
    for (const req of backend.match(() => true)) {
      expect(req.request.headers.keys()).toEqual([]);
      req.flush('');
    }
  });

  it('AI-04: 401 → refresh 200 → the request is repeated with the new token', async () => {
    const result = firstValueFrom(http.get(WEEK));
    unauthorized(backend.expectOne(WEEK));
    const refresh = backend.expectOne(REFRESH);
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush({ ...AUTH_RESPONSE, accessToken: NEW });
    const retried = backend.expectOne(WEEK);
    expect(bearerOf(retried)).toBe(`Bearer ${NEW}`);
    expect(retried.request.context.get(RETRIED)).toBe(true);
    retried.flush({ ok: true });
    expect(await result).toEqual({ ok: true });
    expect(session.accessToken()).toBe(NEW);
  });

  it('AI-05: three parallel 401 → one refresh, three repeats', async () => {
    const urls = [WEEK, '/api/v1/workspaces/ws-1/templates', '/api/v1/auth/me'];
    const results = Promise.all(urls.map((url) => firstValueFrom(http.get(url))));
    for (const url of urls) unauthorized(backend.expectOne(url));
    refreshOk(); // expectOne: exactly one refresh
    for (const url of urls) {
      const req = backend.expectOne(url);
      expect(bearerOf(req)).toBe(`Bearer ${NEW}`);
      req.flush({ url });
    }
    expect(await results).toEqual(urls.map((url) => ({ url })));
  });

  it('AI-06 (DoD): the repeat gets 401 again → no second refresh, SESSION_EXPIRED', async () => {
    const result = settle(firstValueFrom(http.get(WEEK)));
    unauthorized(backend.expectOne(WEEK));
    refreshOk();
    unauthorized(backend.expectOne(WEEK));
    backend.expectNone(REFRESH);
    backend.expectNone(WEEK);
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'SESSION_EXPIRED', status: 401 });
    expect(session.status()).toBe('anonymous');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('AI-07: refresh refused → clear, /login?returnUrl=<url>, one toast for all requests', async () => {
    const show = vi.spyOn(toast, 'show');
    const results = Promise.all(
      [WEEK, '/api/v1/auth/me'].map((u) => settle(firstValueFrom(http.get(u)))),
    );
    unauthorized(backend.expectOne(WEEK));
    unauthorized(backend.expectOne('/api/v1/auth/me'));
    backend.expectOne(REFRESH).flush(REFRESH_INVALID, { status: 401, statusText: 'Unauthorized' });

    for (const error of await results) {
      expect(error).toMatchObject({ code: 'SESSION_EXPIRED' });
    }
    expect(session.status()).toBe('anonymous');
    expect(session.accessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/week/2026-11-16?day=2026-11-18' },
    });
    expect(show).toHaveBeenCalledTimes(1);
    expect(toast.current()?.text).toBe('Сессия истекла, войдите снова.');
  });

  it('AI-08: 401 INVALID_CREDENTIALS from /auth/login → no refresh, the error as is', async () => {
    const result = settle(firstValueFrom(http.post('/api/v1/auth/login', {})));
    backend
      .expectOne('/api/v1/auth/login')
      .flush(PROBLEM_INVALID_CREDENTIALS, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone(REFRESH);
    expect(await result).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(session.status()).toBe('authenticated');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'VERSION_CONFLICT'],
    [500, 'INTERNAL_ERROR'],
  ])('AI-09: %i passes unchanged', async (status, code) => {
    const result = settle(firstValueFrom(http.get(WEEK)));
    backend.expectOne(WEEK).flush({ status, title: 'x', code }, { status, statusText: 'x' });
    backend.expectNone(REFRESH);
    expect(await result).toMatchObject({ code, status });
  });

  it('AI-10: POST /auth/logout-all carries both Authorization and X-Requested-With', () => {
    http.post('/api/v1/auth/logout-all', null).subscribe();
    const req = backend.expectOne('/api/v1/auth/logout-all');
    expect(bearerOf(req)).toBe(`Bearer ${OLD}`);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('an expired token is not sent; the 401 refreshes and the request is repeated', async () => {
    session.setAuth({ ...AUTH_RESPONSE, accessToken: OLD, expiresIn: 0 });
    const result = firstValueFrom(http.get(WEEK));
    const first = backend.expectOne(WEEK);
    expect(first.request.headers.has('Authorization')).toBe(false);
    unauthorized(first);
    refreshOk();
    backend.expectOne(WEEK).flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('without a session a 401 is not refreshed: there is nothing to restore', async () => {
    session.clear();
    const result = settle(firstValueFrom(http.get('/api/v1/auth/me')));
    unauthorized(backend.expectOne('/api/v1/auth/me'));
    backend.expectNone(REFRESH);
    expect(await result).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('refresh fails with a network error → the session stays, the error goes to the caller', async () => {
    const result = settle(firstValueFrom(http.get(WEEK)));
    unauthorized(backend.expectOne(WEEK));
    backend.expectOne(REFRESH).error(new ProgressEvent('error'));
    expect(await result).toMatchObject({ code: 'NETWORK_ERROR' });
    expect(session.status()).toBe('authenticated');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a non-401 error of the repeat passes unchanged', async () => {
    const result = settle(firstValueFrom(http.get(WEEK)));
    unauthorized(backend.expectOne(WEEK));
    refreshOk();
    backend
      .expectOne(WEEK)
      .flush(
        { status: 404, title: 'x', code: 'WORKSPACE_NOT_FOUND' },
        { status: 404, statusText: 'x' },
      );
    expect(await result).toMatchObject({ code: 'WORKSPACE_NOT_FOUND' });
    expect(session.status()).toBe('authenticated');
  });

  it("the caller's request stays unmarked: a resubscription can refresh again", async () => {
    const result = firstValueFrom(http.get(WEEK).pipe(retry(1)));
    unauthorized(backend.expectOne(WEEK));
    refreshOk();
    // The repeat fails with 500, the caller's retry() sends the original request again.
    backend
      .expectOne(WEEK)
      .flush({ status: 500, title: 'x', code: 'INTERNAL_ERROR' }, { status: 500, statusText: 'x' });
    const again = backend.expectOne(WEEK);
    expect(again.request.context.get(RETRIED)).toBe(false);
    unauthorized(again);
    backend.expectOne(REFRESH).flush({ ...AUTH_RESPONSE, accessToken: 'eyJ.third.sample' });
    backend.expectOne(WEEK).flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });
});
