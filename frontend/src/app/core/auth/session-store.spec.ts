import { TestBed } from '@angular/core/testing';
import type { AuthResponse } from '../api/models/auth.models';
import {
  AUTH_RESPONSE,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '../api/models/testing/samples';
import type { WorkspaceResponse } from '../api/models/workspace.models';
import { CLOCK } from '../time/zone-clock';
import { SessionStore } from './session-store';

const [OWNER, PARTNER] = WORKSPACE_FULL_PAIR.members;

/** The partner signs in on this device. */
const AUTH_PARTNER: AuthResponse = {
  ...AUTH_RESPONSE,
  accessToken: 'eyJ.partner-token.sample',
  user: {
    id: PARTNER.userId,
    email: 'partner@example.test',
    displayName: PARTNER.displayName,
    createdAt: '2026-11-17T11:06:49.000000Z',
  },
};

/** The backend sorts by seat; the store must not rely on it. */
const PAIR_REVERSED: WorkspaceResponse = {
  ...WORKSPACE_FULL_PAIR,
  members: [PARTNER, OWNER],
};

describe('SessionStore', () => {
  let store: SessionStore;
  let now: number;

  beforeEach(() => {
    now = Date.UTC(2026, 10, 18, 9, 0);
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: () => now }] });
    store = TestBed.inject(SessionStore);
  });

  it('starts unknown and empty', () => {
    expect(store.status()).toBe('unknown');
    expect(store.user()).toBeNull();
    expect(store.workspace()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.hasWorkspace()).toBe(false);
    expect(store.members()).toEqual([]);
    expect(store.me()).toBeNull();
    expect(store.partner()).toBeNull();
    expect(store.timeZone()).toBeNull();
    expect(store.isPartnerMissing()).toBe(false);
    expect(store.accessToken()).toBeNull();
  });

  it('setAuth: authenticated, the user and the token; no workspace yet', () => {
    store.setAuth(AUTH_RESPONSE);
    expect(store.status()).toBe('authenticated');
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()).toEqual(AUTH_RESPONSE.user);
    expect(store.accessToken()).toBe(AUTH_RESPONSE.accessToken);
    expect(store.hasWorkspace()).toBe(false);
    expect(store.isPartnerMissing()).toBe(false);
  });

  it('only the owner in the workspace: me is seat 1, the partner is missing', () => {
    store.setAuth(AUTH_RESPONSE);
    store.setWorkspace(WORKSPACE_CREATED);
    expect(store.hasWorkspace()).toBe(true);
    expect(store.timeZone()).toBe('Asia/Almaty');
    expect(store.me()).toEqual(WORKSPACE_CREATED.members[0]);
    expect(store.partner()).toBeNull();
    expect(store.isPartnerMissing()).toBe(true);
  });

  it('members are sorted by seat, whatever order the response has', () => {
    store.setAuth(AUTH_RESPONSE);
    store.setWorkspace(PAIR_REVERSED);
    expect(store.members().map((m) => m.seat)).toEqual([1, 2]);
    // The response itself is not reordered.
    expect(PAIR_REVERSED.members[0]).toBe(PARTNER);
  });

  it.each([
    ['the owner', AUTH_RESPONSE, OWNER, PARTNER],
    ['the partner', AUTH_PARTNER, PARTNER, OWNER],
  ])('signed in as %s: partner is the other member', (_, auth, me, partner) => {
    store.setAuth(auth);
    store.setWorkspace(PAIR_REVERSED);
    expect(store.me()).toEqual(me);
    expect(store.partner()).toEqual(partner);
    expect(store.isPartnerMissing()).toBe(false);
  });

  it('setWorkspace(null) → onboarding again', () => {
    store.setAuth(AUTH_RESPONSE);
    store.setWorkspace(WORKSPACE_FULL_PAIR);
    store.setWorkspace(null);
    expect(store.hasWorkspace()).toBe(false);
    expect(store.members()).toEqual([]);
    expect(store.timeZone()).toBeNull();
  });

  it('refresh of the same user keeps the workspace and replaces the token', () => {
    store.setAuth(AUTH_RESPONSE);
    store.setWorkspace(WORKSPACE_FULL_PAIR);
    store.setAuth({ ...AUTH_RESPONSE, accessToken: 'eyJ.new.sample' });
    expect(store.workspace()).toBe(WORKSPACE_FULL_PAIR);
    expect(store.accessToken()).toBe('eyJ.new.sample');
  });

  it('a different user drops the previous workspace', () => {
    store.setAuth(AUTH_RESPONSE);
    store.setWorkspace(WORKSPACE_FULL_PAIR);
    store.setAuth(AUTH_PARTNER);
    expect(store.user()?.id).toBe(PARTNER.userId);
    expect(store.workspace()).toBeNull();
  });

  it('clear() forgets everything and makes the session anonymous', () => {
    store.setAuth(AUTH_RESPONSE);
    store.setWorkspace(WORKSPACE_FULL_PAIR);
    store.clear();
    expect(store.status()).toBe('anonymous');
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(store.workspace()).toBeNull();
    expect(store.members()).toEqual([]);
    expect(store.me()).toBeNull();
    expect(store.partner()).toBeNull();
    expect(store.isPartnerMissing()).toBe(false);
    expect(store.accessToken()).toBeNull();
  });

  it('the token expires expiresIn seconds after the response arrived', () => {
    store.setAuth(AUTH_RESPONSE); // expiresIn 900
    now += 899_999;
    expect(store.accessToken()).toBe(AUTH_RESPONSE.accessToken);
    now += 1;
    expect(store.accessToken()).toBeNull();
    // Still signed in: the next 401 refreshes the token (§5.2).
    expect(store.isAuthenticated()).toBe(true);
  });

  it('DoD: the token is reachable only through accessToken()', () => {
    store.setAuth(AUTH_RESPONSE);
    // Every own property, signals read: none holds the token (#token is not enumerable).
    const exposed = Object.values(store).map((value: unknown) =>
      typeof value === 'function' ? (value as () => unknown)() : value,
    );
    expect(JSON.stringify(exposed)).not.toContain(AUTH_RESPONSE.accessToken);
    expect(JSON.stringify(store.user())).not.toContain(AUTH_RESPONSE.accessToken);
  });
});
