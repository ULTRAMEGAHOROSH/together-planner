import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  AUTH_RESPONSE,
  PROBLEM_WORKSPACE_NOT_FOUND,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '../api/models/testing/samples';
import { errorInterceptor } from '../error/error-interceptor';
import { ERROR_MESSAGES } from '../error/error-messages';
import { ToastService } from '../notify/toast-service';
import { CLOCK } from '../time/zone-clock';
import { authInterceptor } from './auth-interceptor';
import { AuthService } from './auth-service';
import { SessionStore } from './session-store';
import {
  provideWorkspaceRefresh,
  WORKSPACE_REFRESH_MIN_INTERVAL_MS,
  WorkspaceRefresh,
} from './workspace-refresh';

const W2 = '/api/v1/workspaces/current';
const NOT_FOUND = { status: 404, statusText: 'Not Found' };

describe('WorkspaceRefresh (WS-07)', () => {
  let now: number;
  let backend: HttpTestingController;
  let session: SessionStore;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    now = 1_800_000_000_000;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideWorkspaceRefresh(),
        { provide: CLOCK, useValue: () => now },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_CREATED); // one member: the partner is missing
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
    // Back to jsdom's own getter (see `hideTab`).
    delete (document as { visibilityState?: string }).visibilityState;
  });

  const focus = () => window.dispatchEvent(new Event('focus'));
  const visible = () => document.dispatchEvent(new Event('visibilitychange'));
  const toast = () => TestBed.inject(ToastService).current()?.text ?? null;
  const hideTab = () =>
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

  it('the tab comes back while alone → W2 → the partner is in the session', async () => {
    focus();
    backend.expectOne(W2).flush(WORKSPACE_FULL_PAIR);
    expect(session.isPartnerMissing()).toBe(false);
    expect(session.partner()?.displayName).toBe(WORKSPACE_FULL_PAIR.members[1].displayName);

    // Both seats taken: nothing more to wait for.
    now += WORKSPACE_REFRESH_MIN_INTERVAL_MS;
    focus();
    backend.expectNone(W2);
  });

  it('at most once per 10 s: visibilitychange and focus of one tab switch → one W2', () => {
    visible();
    focus();
    backend.expectOne(W2).flush(WORKSPACE_CREATED);

    now += WORKSPACE_REFRESH_MIN_INTERVAL_MS - 1;
    focus();
    backend.expectNone(W2);

    now += 1;
    visible();
    backend.expectOne(W2).flush(WORKSPACE_CREATED);
  });

  it('a hidden tab does not ask (visibilitychange to hidden)', () => {
    hideTab();
    visible();
    backend.expectNone(W2);
  });

  it.each([
    ['without a workspace', null],
    ['with both members', WORKSPACE_FULL_PAIR],
  ])('%s → no W2', (_, workspace) => {
    session.setWorkspace(workspace);
    focus();
    visible();
    backend.expectNone(W2);
  });

  it('the workspace is gone (404) → null in the session → /onboarding', async () => {
    focus();
    backend.expectOne(W2).flush(PROBLEM_WORKSPACE_NOT_FOUND, NOT_FOUND);
    expect(session.workspace()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/onboarding');
  });

  it('a failed background check stays silent: no toast, the session keeps the workspace', () => {
    focus();
    backend.expectOne(W2).error(new ProgressEvent('error'));
    expect(toast()).toBeNull();
    expect(session.workspace()).toEqual(WORKSPACE_CREATED);
    expect(navigate).not.toHaveBeenCalled();
  });

  describe('workspaceNotFound() — for stores (decisions §9)', () => {
    let refresh: WorkspaceRefresh;
    beforeEach(() => (refresh = TestBed.inject(WorkspaceRefresh)));

    it('W2 404 → /onboarding', () => {
      refresh.workspaceNotFound();
      backend.expectOne(W2).flush(PROBLEM_WORKSPACE_NOT_FOUND, NOT_FOUND);
      expect(session.workspace()).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/onboarding');
    });

    it('W2 still returns a workspace → it is in the session, the user stays', () => {
      session.setWorkspace(null);
      refresh.workspaceNotFound();
      backend.expectOne(W2).flush(WORKSPACE_FULL_PAIR);
      expect(session.workspace()).toEqual(WORKSPACE_FULL_PAIR);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('W2 fails → a toast, no navigation', () => {
      refresh.workspaceNotFound();
      backend.expectOne(W2).error(new ProgressEvent('error'));
      expect(toast()).toBe(ERROR_MESSAGES.NETWORK_ERROR);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('stops listening when the app is destroyed', () => {
    const reload = vi.spyOn(TestBed.inject(AuthService), 'reloadWorkspace');
    TestBed.resetTestingModule();
    focus();
    visible();
    expect(reload).not.toHaveBeenCalled();
    // The module is gone: nothing left for afterEach to verify.
    backend = { verify: () => undefined } as unknown as HttpTestingController;
  });
});
