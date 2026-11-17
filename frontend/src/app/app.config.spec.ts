import { DecimalPipe, formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api/api-base-url';
import { PROBLEM_UNAUTHORIZED } from '@core/api/models/testing/samples';
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
});
