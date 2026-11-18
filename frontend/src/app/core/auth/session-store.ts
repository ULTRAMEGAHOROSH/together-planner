// The one session state (FD-25, decisions §4): who is signed in, their workspace and the
// access token. The token lives only in memory (FD-35) and is read only via accessToken().
import { computed, inject, Injectable, signal } from '@angular/core';
import type { AuthResponse } from '../api/models/auth.models';
import type { UserResponse } from '../api/models/user.models';
import type { MemberResponse, WorkspaceResponse } from '../api/models/workspace.models';
import { CLOCK } from '../time/zone-clock';

/** `unknown` until the start-up refresh (FD-39) has answered. */
export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated';

interface AccessToken {
  value: string;
  /** Epoch ms, counted from when the response arrived (no clock skew with the server). */
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly clock = inject(CLOCK);
  private readonly statusState = signal<SessionStatus>('unknown');
  private readonly userState = signal<UserResponse | null>(null);
  private readonly workspaceState = signal<WorkspaceResponse | null>(null);
  // A real private field (not TS `private`), not a signal: nothing renders the token, and
  // nothing outside can read it, not even through `store["token"]`.
  #token: AccessToken | null = null;

  readonly status = this.statusState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly workspace = this.workspaceState.asReadonly();

  readonly isAuthenticated = computed(() => this.status() === 'authenticated');
  readonly hasWorkspace = computed(() => this.workspace() !== null);
  /** Members by seat: the creator (seat 1) first. Empty without a workspace. */
  readonly members = computed<readonly MemberResponse[]>(() =>
    [...(this.workspace()?.members ?? [])].sort((a, b) => a.seat - b.seat),
  );
  /** The signed-in user as a member of the workspace. */
  readonly me = computed(() => this.members().find((m) => m.userId === this.user()?.id) ?? null);
  /** The other member; `null` while nobody has joined. */
  readonly partner = computed(
    () => this.members().find((m) => m.userId !== this.user()?.id) ?? null,
  );
  /** IANA zone of the workspace: "now" and "today" are counted in it (FD-33). */
  readonly timeZone = computed(() => this.workspace()?.timeZone ?? null);
  /** The workspace exists but the partner has not joined yet (invite card, SHELL-04). */
  readonly isPartnerMissing = computed(() => this.hasWorkspace() && this.partner() === null);

  /** After A1, A2, A3. A different user than before drops the old workspace. */
  setAuth(response: AuthResponse): void {
    this.#token = {
      value: response.accessToken,
      expiresAt: this.clock() + response.expiresIn * 1000,
    };
    if (this.user()?.id !== response.user.id) {
      this.workspaceState.set(null);
    }
    this.userState.set(response.user);
    this.statusState.set('authenticated');
  }

  /** After A6, W1, W2, W6; `null` — no workspace yet (onboarding). */
  setWorkspace(workspace: WorkspaceResponse | null): void {
    this.workspaceState.set(workspace);
  }

  /** Sign-out or a failed refresh: forgets everything, the user is anonymous. */
  clear(): void {
    this.#token = null;
    this.userState.set(null);
    this.workspaceState.set(null);
    this.statusState.set('anonymous');
  }

  /**
   * The access token for the Bearer header, `null` when there is none or it has expired:
   * an expired token is not sent, the backend answers 401 and the refresh flow runs (§5.2).
   */
  accessToken(): string | null {
    if (this.#token === null || this.clock() >= this.#token.expiresAt) {
      return null;
    }
    return this.#token.value;
  }
}
