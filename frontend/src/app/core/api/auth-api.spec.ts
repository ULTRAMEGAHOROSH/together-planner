import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { AuthApi } from './auth-api';
import { AUTH_RESPONSE, ME_WITHOUT_WORKSPACE } from './models/testing/samples';

describe('AuthApi (A1–A6)', () => {
  let api: AuthApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuthApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Subscribes, checks the one request and answers it; returns what the caller got. */
  async function call<T>(
    request: Observable<T>,
    expected: { method: string; url: string; body: unknown },
    response: object | null,
    status = 200,
  ): Promise<T> {
    const result = firstValueFrom(request, { defaultValue: undefined as T });
    const req = backend.expectOne(expected.url);
    expect(req.request.method).toBe(expected.method);
    expect(req.request.body).toEqual(expected.body);
    // Headers are authInterceptor's job (AUTH-04): the API adds none.
    expect(req.request.headers.keys()).toEqual([]);
    req.flush(response, { status, statusText: 'OK' });
    return result;
  }

  it('A1 register: POST /api/v1/auth/register with the form body', async () => {
    const body = { email: 'a@example.test', password: 'secret-123', displayName: 'Даулет' };
    const result = await call(
      api.register(body),
      { method: 'POST', url: '/api/v1/auth/register', body },
      AUTH_RESPONSE,
      201,
    );
    expect(result).toEqual(AUTH_RESPONSE);
  });

  it('A2 login: POST /api/v1/auth/login with email and password', async () => {
    const body = { email: 'a@example.test', password: 'secret-123' };
    const result = await call(
      api.login(body),
      { method: 'POST', url: '/api/v1/auth/login', body },
      AUTH_RESPONSE,
    );
    expect(result).toEqual(AUTH_RESPONSE);
  });

  it('A3 refresh: POST /api/v1/auth/refresh without a body (the cookie is the credential)', async () => {
    const result = await call(
      api.refresh(),
      { method: 'POST', url: '/api/v1/auth/refresh', body: null },
      AUTH_RESPONSE,
    );
    expect(result).toEqual(AUTH_RESPONSE);
  });

  it.each([
    ['A4 logout', (a: AuthApi) => a.logout(), '/api/v1/auth/logout'],
    ['A5 logoutAll', (a: AuthApi) => a.logoutAll(), '/api/v1/auth/logout-all'],
  ])('%s: POST %s without a body, 204 → completes with no value', async (_, send, url) => {
    const result = await call(send(api), { method: 'POST', url, body: null }, null, 204);
    expect(result).toBeNull();
  });

  it('A6 me: GET /api/v1/auth/me', async () => {
    const result = await call(
      api.me(),
      { method: 'GET', url: '/api/v1/auth/me', body: null },
      ME_WITHOUT_WORKSPACE,
    );
    expect(result).toEqual(ME_WITHOUT_WORKSPACE);
  });

  it('uses API_BASE_URL', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.example.test/v1' },
      ],
    });
    const other = TestBed.inject(AuthApi);
    backend = TestBed.inject(HttpTestingController);
    await call(
      other.me(),
      { method: 'GET', url: 'https://api.example.test/v1/auth/me', body: null },
      ME_WITHOUT_WORKSPACE,
    );
  });

  it('errors are not handled here: the HTTP error reaches the caller', async () => {
    const result = firstValueFrom(api.login({ email: 'a@example.test', password: 'x' })).catch(
      (error: unknown) => error,
    );
    backend
      .expectOne('/api/v1/auth/login')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await result).toMatchObject({ status: 401 });
  });
});
