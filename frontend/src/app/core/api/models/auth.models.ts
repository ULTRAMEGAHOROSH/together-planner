// Auth DTOs (A1–A6). Source: docs/backend-spec-v2.md §8.3 (backend: auth/dto/*.java).
// The refresh token never appears in JSON: it is the HttpOnly cookie `tp_refresh` (spec §10.4).
import type { UserResponse } from './user.models';
import type { WorkspaceResponse } from './workspace.models';

/** A1 body. Limits: email ≤ 254, password 8–72 chars and ≤ 72 UTF-8 bytes, displayName ≤ 50. */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

/** A2 body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** A1, A2, A3 response. `expiresIn` is in seconds (access token TTL, 15 min). */
export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserResponse;
}

/** A6 response. `workspace: null` → the user has no workspace yet (onboarding). */
export interface MeResponse {
  user: UserResponse;
  workspace: WorkspaceResponse | null;
}
