// User DTOs. Source: docs/backend-spec-v2.md §8.2 (backend: user/dto/UserResponse.java).
import type { IsoInstant, Uuid } from './common.models';

/** spec §8.2 UserResponse. `email` is stored trimmed and lower-cased. */
export interface UserResponse {
  id: Uuid;
  email: string;
  displayName: string;
  createdAt: IsoInstant;
}
