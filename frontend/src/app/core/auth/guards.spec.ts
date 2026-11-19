import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AUTH_RESPONSE, WORKSPACE_CREATED } from '../api/models/testing/samples';
import {
  authGuard,
  guestGuard,
  inviteeGuard,
  noWorkspaceGuard,
  safeReturnUrl,
  workspaceGuard,
} from './guards';
import { SessionStore } from './session-store';

describe('guards', () => {
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(SessionStore);
  });

  const run = (guard: () => true | UrlTree) => {
    const result = TestBed.runInInjectionContext(guard);
    return result === true ? true : TestBed.inject(Router).serializeUrl(result);
  };

  it.each([
    ['unknown', null, '/login', '/register', true, '/onboarding', true],
    ['anonymous', null, '/login', '/register', true, '/onboarding', true],
    ['without a workspace', false, true, true, '/week', '/onboarding', true],
    ['with a workspace', true, true, true, '/week', true, '/week'],
  ] as const)('%s', (status, workspace, auth, invitee, guest, needsWorkspace, needsNone) => {
    if (status === 'anonymous') session.clear();
    if (workspace !== null) session.setAuth(AUTH_RESPONSE);
    if (workspace) session.setWorkspace(WORKSPACE_CREATED);
    // Outside a navigation authGuard has no URL to come back to.
    expect(run(authGuard)).toBe(auth);
    expect(run(inviteeGuard)).toBe(invitee);
    expect(run(guestGuard)).toBe(guest);
    expect(run(workspaceGuard)).toBe(needsWorkspace);
    expect(run(noWorkspaceGuard)).toBe(needsNone);
  });
});

describe('safeReturnUrl (DoD)', () => {
  it.each([
    ['/week/2026-11-16', '/week/2026-11-16'],
    ['/join?code=K7QM2XPA', '/join?code=K7QM2XPA'],
    ['/', '/'],
    ['//evil.test', null],
    ['/\\evil.test', null],
    ['https://evil.test/week', null],
    ['javascript:alert(1)', null],
    ['week', null],
    ['', null],
    [null, null],
    [undefined, null],
    [['/week'], null],
  ])('%j → %j', (value, expected) => {
    expect(safeReturnUrl(value)).toBe(expected);
  });
});
