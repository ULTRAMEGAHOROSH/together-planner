import type { AuthResponse, MeResponse, RegisterRequest } from './auth.models';
import type { MemberResponse, UpdateWorkspaceRequest, WorkspaceResponse } from './workspace.models';
import {
  AUTH_RESPONSE,
  INVITE,
  ME_WITHOUT_WORKSPACE,
  ME_WITH_WORKSPACE,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from './testing/samples';

// The samples are verbatim backend responses checked with `satisfies` (excess fields
// would fail compilation). These tests pin the shape details the frontend relies on.
describe('auth / user / workspace models (spec §8.2–§8.4)', () => {
  it('AuthResponse: Bearer token with TTL in seconds and the user', () => {
    expect(Object.keys(AUTH_RESPONSE)).toEqual(['accessToken', 'tokenType', 'expiresIn', 'user']);
    expect(AUTH_RESPONSE.tokenType).toBe('Bearer');
    expect(AUTH_RESPONSE.expiresIn).toBe(900);
    expect(Object.keys(AUTH_RESPONSE.user)).toEqual(['id', 'email', 'displayName', 'createdAt']);
  });

  it('MeResponse: `workspace` is sent explicitly as null before onboarding', () => {
    expect('workspace' in ME_WITHOUT_WORKSPACE).toBe(true);
    expect(ME_WITHOUT_WORKSPACE.workspace).toBeNull();
    expect(ME_WITH_WORKSPACE.workspace?.members).toHaveLength(2);
  });

  it('WorkspaceResponse: creator is OWNER on seat 1, partner MEMBER on seat 2, sorted by seat', () => {
    expect(Object.keys(WORKSPACE_CREATED)).toEqual([
      'id',
      'name',
      'timeZone',
      'members',
      'createdAt',
    ]);
    expect(WORKSPACE_CREATED.members.map((m) => [m.role, m.seat])).toEqual([['OWNER', 1]]);
    expect(WORKSPACE_FULL_PAIR.members.map((m) => [m.role, m.seat])).toEqual([
      ['OWNER', 1],
      ['MEMBER', 2],
    ]);
    expect(Object.keys(WORKSPACE_FULL_PAIR.members[0])).toEqual([
      'userId',
      'displayName',
      'role',
      'seat',
      'joinedAt',
    ]);
  });

  it('InviteResponse: raw code for the link, dashed code for people', () => {
    expect(INVITE.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(INVITE.displayCode).toBe(`${INVITE.code.slice(0, 4)}-${INVITE.code.slice(4)}`);
  });

  it('instants come with varying fractional precision', () => {
    const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;
    for (const value of [
      AUTH_RESPONSE.user.createdAt,
      WORKSPACE_CREATED.createdAt,
      WORKSPACE_FULL_PAIR.createdAt,
      INVITE.expiresAt,
    ]) {
      expect(value).toMatch(instant);
    }
    expect(WORKSPACE_CREATED.createdAt.split('.')[1]).toHaveLength(10); // 9 digits (nanoseconds) + Z
    expect(WORKSPACE_FULL_PAIR.createdAt.split('.')[1]).toHaveLength(7); // 6 digits + Z
  });

  it('types reject values outside the contract (compile-time)', () => {
    const member: MemberResponse = { ...WORKSPACE_FULL_PAIR.members[1] };
    // @ts-expect-error — a workspace has only seats 1 and 2
    const badSeat: MemberResponse = { ...member, seat: 3 };
    // @ts-expect-error — token type is always "Bearer"
    const badToken: AuthResponse = { ...AUTH_RESPONSE, tokenType: 'Basic' };
    // @ts-expect-error — `workspace` must be present (null, not missing)
    const noWorkspace: MeResponse = { user: AUTH_RESPONSE.user };
    // @ts-expect-error — displayName is required
    const badRegister: RegisterRequest = { email: 'a@b.test', password: 'password-1' };
    const rename: UpdateWorkspaceRequest = { name: 'Дом' };
    const keepAll: UpdateWorkspaceRequest = { name: null, timeZone: null };
    const ws: WorkspaceResponse = WORKSPACE_CREATED;
    expect([badSeat, badToken, noWorkspace, badRegister, rename, keepAll, ws]).toHaveLength(7);
  });
});
