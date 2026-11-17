// Workspace DTOs (W1–W6). Source: docs/backend-spec-v2.md §8.2, §8.4
// (backend: workspace/dto/*.java).
import type { IsoInstant, Uuid } from './common.models';
import type { WorkspaceRole } from './enums';

/** A workspace has exactly two places: the creator takes seat 1, the partner seat 2. */
export type Seat = 1 | 2;

/** spec §8.2 MemberResponse. Lists are always sorted by `seat`. */
export interface MemberResponse {
  userId: Uuid;
  displayName: string;
  role: WorkspaceRole;
  seat: Seat;
  joinedAt: IsoInstant;
}

/** W1 body. `name` ≤ 60 (trimmed by the backend), `timeZone` — IANA region id ≤ 64. */
export interface CreateWorkspaceRequest {
  name: string;
  timeZone: string;
}

/** W3 body. A missing or `null` field means "do not change". */
export interface UpdateWorkspaceRequest {
  name?: string | null;
  timeZone?: string | null;
}

/** W6 body. Case and the dash do not matter: the backend normalizes the code. */
export interface JoinWorkspaceRequest {
  code: string;
}

/** W1, W2, W3, W6 response; also `MeResponse.workspace`. */
export interface WorkspaceResponse {
  id: Uuid;
  name: string;
  timeZone: string;
  members: MemberResponse[];
  createdAt: IsoInstant;
}

/**
 * W5 response. `code` ("K7QM2XPA") goes into the join link `/join?code=`,
 * `displayCode` ("K7QM-2XPA") is shown to people. Valid for 7 days.
 */
export interface InviteResponse {
  code: string;
  displayCode: string;
  expiresAt: IsoInstant;
}
