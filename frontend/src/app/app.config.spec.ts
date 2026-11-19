import { DecimalPipe, formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ApplicationInitStatus, LOCALE_ID } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api/api-base-url';
import {
  AUTH_RESPONSE,
  PROBLEM_WORKSPACE_NOT_FOUND,
  PROBLEM_UNAUTHORIZED,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { isApiError } from '@core/error/api-error';
import { firstValueFrom } from 'rxjs';
import { appConfig } from './app.config';

describe('appConfig (FND-06)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, DecimalPipe] });
  });

  it('provides HttpClient', () => {
    expect(TestBed.inject(HttpClient)).toBeTruthy();
  });

  it('uses /api/v1 as the API base path', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe('/api/v1');
  });

  it('uses the Russian locale for pipes', () => {
    expect(TestBed.inject(LOCALE_ID)).toBe('ru');
    expect(TestBed.inject(DecimalPipe).transform(1234.5)).toBe('1 234,5');
    expect(formatDate('2026-11-20', 'd MMMM y', 'ru')).toBe('20 ноября 2026');
  });
});

describe('appConfig interceptors (CORE-04)', () => {
  it('errorInterceptor is registered: HTTP errors arrive as ApiError', async () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    const result = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/auth/me')).catch(
      (error: unknown) => error,
    );
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/me')
      .flush(PROBLEM_UNAUTHORIZED, { status: 401, statusText: 'Unauthorized' });
    const error = await result;
    expect(isApiError(error) && error.code).toBe('UNAUTHORIZED');
  });

  it('authInterceptor runs first (AUTH-04): headers are set, and it sees ApiError', async () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    TestBed.inject(SessionStore).setAuth(AUTH_RESPONSE);
    const result = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/auth/me')).catch(
      (error: unknown) => error,
    );
    const backend = TestBed.inject(HttpTestingController);
    const me = backend.expectOne('/api/v1/auth/me');
    expect(me.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(me.request.headers.get('Authorization')).toBe(`Bearer ${AUTH_RESPONSE.accessToken}`);
    // A 401 starts a refresh only if the interceptor recognises it as an ApiError.
    me.flush(PROBLEM_UNAUTHORIZED, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/auth/refresh').flush(null, { status: 503, statusText: 'x' });
    expect(await result).toMatchObject({ code: 'UNKNOWN', status: 503 });
  });
});

describe('appConfig session restore (AUTH-05)', () => {
  it('the app starts only after refresh → W2', async () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    const init = TestBed.inject(ApplicationInitStatus);
    const backend = TestBed.inject(HttpTestingController);
    expect(init.done).toBe(false);
    backend.expectOne('/api/v1/auth/refresh').flush(AUTH_RESPONSE);
    backend
      .expectOne('/api/v1/workspaces/current')
      .flush(PROBLEM_WORKSPACE_NOT_FOUND, { status: 404, statusText: 'Not Found' });
    await init.donePromise;
    expect(TestBed.inject(SessionStore).status()).toBe('authenticated');
  });
});
