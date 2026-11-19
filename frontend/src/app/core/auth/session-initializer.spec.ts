import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ProblemDetail } from '../api/models/common.models';
import { AUTH_RESPONSE, WORKSPACE_CREATED } from '../api/models/testing/samples';
import { errorInterceptor } from '../error/error-interceptor';
import { ERROR_MESSAGES } from '../error/error-messages';
import { ToastService } from '../notify/toast-service';
import { authInterceptor } from './auth-interceptor';
import { provideSessionRestore } from './session-initializer';
import { SessionStore } from './session-store';

const REFRESH_INVALID = {
  detail: 'Missing refresh token cookie',
  instance: '/api/v1/auth/refresh',
  status: 401,
  title: 'Unauthorized',
  code: 'REFRESH_TOKEN_INVALID',
} satisfies ProblemDetail;

describe('provideSessionRestore (FD-39)', () => {
  let backend: HttpTestingController;
  let init: ApplicationInitStatus;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideSessionRestore(),
      ],
    });
    init = TestBed.inject(ApplicationInitStatus);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => backend.verify());

  it('DoD: the app waits — not done while refresh and W2 are in flight', async () => {
    expect(init.done).toBe(false);
    expect(session.status()).toBe('unknown');
    backend.expectOne('/api/v1/auth/refresh').flush(AUTH_RESPONSE);
    expect(init.done).toBe(false);
    backend.expectOne('/api/v1/workspaces/current').flush(WORKSPACE_CREATED);
    await init.donePromise;
    expect(init.done).toBe(true);
    expect(session.status()).toBe('authenticated');
    expect(session.hasWorkspace()).toBe(true);
  });

  it('refresh refused → starts anonymous', async () => {
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(REFRESH_INVALID, { status: 401, statusText: 'x' });
    await init.donePromise;
    expect(session.status()).toBe('anonymous');
    expect(TestBed.inject(ToastService).current()).toBeNull();
  });

  it('network down → starts anonymous with a toast', async () => {
    backend.expectOne('/api/v1/auth/refresh').error(new ProgressEvent('error'));
    await init.donePromise;
    expect(session.status()).toBe('anonymous');
    expect(TestBed.inject(ToastService).current()?.text).toBe(ERROR_MESSAGES.NETWORK_ERROR);
  });
});
