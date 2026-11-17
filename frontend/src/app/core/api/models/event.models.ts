// Event DTOs (E1–E6). Source: docs/backend-spec-v2.md §8.6 (backend: event/dto/*.java).
// Times are LocalDateTime in the workspace time zone; intervals are half-open [start; end).
import type { IsoDate, IsoInstant, IsoLocalDateTime, Uuid } from './common.models';
import type { EventCategory, EventColor } from './enums';

/**
 * E3 (POST) and E5 (PUT) body. Limits: title ≤ 100, description ≤ 2000,
 * 1–2 participants, end > start, ≤ 31 days, start year 2000–2100.
 * `color: null` = category color. `version` is required in PUT only (spec §8.0).
 */
export interface EventRequest {
  title: string;
  description: string | null;
  start: IsoLocalDateTime;
  end: IsoLocalDateTime;
  participantIds: Uuid[];
  category: EventCategory;
  color: EventColor | null;
  version?: number;
}

/** spec §8.6 — where an event created from a template came from. */
export interface EventSourceResponse {
  templateEventId: Uuid;
  weekStart: IsoDate;
  templateName: string;
}

/**
 * spec §8.6 EventResponse. `source: null` = created manually. `participantIds` is a
 * set on the backend: do not rely on its order. `version` goes back in PUT / DELETE.
 */
export interface EventResponse {
  id: Uuid;
  title: string;
  description: string | null;
  start: IsoLocalDateTime;
  end: IsoLocalDateTime;
  participantIds: Uuid[];
  category: EventCategory;
  color: EventColor | null;
  source: EventSourceResponse | null;
  createdBy: Uuid;
  updatedBy: Uuid;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  version: number;
}
