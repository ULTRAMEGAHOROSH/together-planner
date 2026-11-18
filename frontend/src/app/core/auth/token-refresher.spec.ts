import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { ProblemDetail } from '../api/models/common.models';
import { AUTH_RESPONSE } from '../api/models/testing/samples';
import { ApiError } from '../error/api-error';
import { errorInterceptor } from '../error/error-interceptor';
import { SessionStore } from './session-store';
import { TokenRefresher } from './token-refresher';

const URL = '/api/v1/auth/refresh';

// Bodies as RefreshTokenService writes them.
const ROTATED = {
  detail: 'Token was just rotated elsewhere',
  instance: URL,
  status: 401,
  title: 'Unauthorized',
  code: 'REFRESH_TOKEN_ROTATED',
} satisfies ProblemDetail;
const INVALID = {
  ...ROTATED,
  detail: 'Unknown refresh token',
  code: 'REFRESH_TOKEN_INVALID',
} satisfies ProblemDetail;

describe('TokenRefresher', () => {
  let refresher: TokenRefresher;
  let session: SessionStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // The real chain: errors reach the refresher as ApiError.
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    refresher = TestBed.inject(TokenRefresher);
    session = TestBed.inject(SessionStore);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const ok = (token = AUTH_RESPONSE.accessToken) =>
    backend.expectOne(URL).flush({ ...AUTH_RESPONSE, accessToken: token });
  const fail = (body: ProblemDetail) =>
    backend.expectOne(URL).flush(body, { status: 401, statusText: 'Unauthorized' });
  const settle = (promise: Promise<string>) =>
    promise.then(
      (token) => token,
      (error: unknown) => error,
    );

  it('TR-01: three calls in a row → one request, all three get the same token', async () => {
    const calls = [1, 2, 3].map(() => firstValueFrom(refresher.refresh()));
    const req = backend.expectOne(URL);
    expect(req.request.method).toBe('POST');
    req.flush(AUTH_RESPONSE);
    expect(await Promise.all(calls)).toEqual(Array(3).fill(AUTH_RESPONSE.accessToken));
  });

  it('success puts the response into SessionStore', async () => {
    const token = firstValueFrom(refresher.refresh());
    ok('eyJ.fresh.sample');
    expect(await token).toBe('eyJ.fresh.sample');
    expect(session.status()).toBe('authenticated');
    expect(session.user()).toEqual(AUTH_RESPONSE.user);
    expect(session.accessToken()).toBe('eyJ.fresh.sample');
  });

  it('TR-02: REFRESH_TOKEN_ROTATED, then 200 → two requests, success', async () => {
    const token = firstValueFrom(refresher.refresh());
    fail(ROTATED);
    ok('eyJ.after-retry.sample');
    expect(await token).toBe('eyJ.after-retry.sample');
    expect(session.accessToken()).toBe('eyJ.after-retry.sample');
  });

  it('TR-03: ROTATED twice → the error after the second request, no third one', async () => {
    const result = settle(firstValueFrom(refresher.refresh()));
    fail(ROTATED);
    fail(ROTATED);
    backend.expectNone(URL);
    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('REFRESH_TOKEN_ROTATED');
    expect(session.status()).toBe('unknown');
  });

  it('TR-04: REFRESH_TOKEN_INVALID → the error at once, no retry', async () => {
    const results = [1, 2].map(() => settle(firstValueFrom(refresher.refresh())));
    fail(INVALID);
    backend.expectNone(URL);
    for (const error of await Promise.all(results)) {
      expect((error as ApiError).code).toBe('REFRESH_TOKEN_INVALID');
    }
    // What to do with the session is the caller's decision (AUTH-04, AUTH-05).
    expect(session.status()).toBe('unknown');
  });

  it('a network error is not retried either', async () => {
    const result = settle(firstValueFrom(refresher.refresh()));
    backend.expectOne(URL).error(new ProgressEvent('error'));
    expect((await result) as ApiError).toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('TR-05: a call after the previous one finished → a new request', async () => {
    const first = firstValueFrom(refresher.refresh());
    ok('eyJ.one.sample');
    await first;
    const second = firstValueFrom(refresher.refresh());
    ok('eyJ.two.sample');
    expect(await second).toBe('eyJ.two.sample');
  });

  it('TR-05: after a failure the next call also starts a new request', async () => {
    const first = settle(firstValueFrom(refresher.refresh()));
    fail(INVALID);
    await first;
    const second = firstValueFrom(refresher.refresh());
    ok();
    expect(await second).toBe(AUTH_RESPONSE.accessToken);
  });

  it('a caller that unsubscribes does not cancel the refresh for the others', async () => {
    refresher.refresh().subscribe().unsubscribe();
    const other = firstValueFrom(refresher.refresh());
    const req = backend.expectOne(URL);
    expect(req.cancelled).toBe(false);
    req.flush(AUTH_RESPONSE);
    expect(await other).toBe(AUTH_RESPONSE.accessToken);
  });
});
