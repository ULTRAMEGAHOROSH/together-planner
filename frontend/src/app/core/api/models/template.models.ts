// Template DTOs (T1–T8). Source: docs/backend-spec-v2.md §8.7 (templates),
// §8.8 (apply), §8.9 (history) (backend: template/dto/*.java).
import type { IsoDate, IsoInstant, IsoLocalDateTime, IsoTime, Uuid } from './common.models';
import type { ApplyMode, DayOfWeek, EventCategory, EventColor } from './enums';
import type { EventResponse } from './event.models';

// --- Templates (§8.7) ---

/**
 * One event of a template. `id: null` = new event; existing events MUST keep
 * their id on update (diff by id, spec §9.8). `durationMinutes` 1–10080.
 */
export interface TemplateEventRequest {
  id: Uuid | null;
  title: string;
  description: string | null;
  dayOfWeek: DayOfWeek;
  startTime: IsoTime;
  durationMinutes: number;
  participantIds: Uuid[];
  category: EventCategory;
  color: EventColor | null;
}

/** T2 (POST) and T4 (PUT) body. name ≤ 60, description ≤ 500, ≤ 300 events. */
export interface TemplateRequest {
  name: string;
  description: string | null;
  events: TemplateEventRequest[];
  version?: number;
}

export interface TemplateEventResponse {
  id: Uuid;
  title: string;
  description: string | null;
  dayOfWeek: DayOfWeek;
  startTime: IsoTime;
  durationMinutes: number;
  participantIds: Uuid[];
  category: EventCategory;
  color: EventColor | null;
}

/** T1–T4 response. `events` sorted by (dayOfWeek, startTime); `lastApplication: null` = never applied. */
export interface TemplateResponse {
  id: Uuid;
  name: string;
  description: string | null;
  events: TemplateEventResponse[];
  lastApplication: TemplateApplicationResponse | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  version: number;
}

// --- Applying a template (§8.8) ---

/**
 * T6 (preview) and T7 (apply) body. `weekStart` must be a Monday.
 * For T7 + REPLACE both confirmed sets are required (may be empty) and must be
 * taken from the preview shown to the user: `toDelete[].id` and
 * `restoredDeleted[].templateEventId`. Ignored by T6 and by MERGE / FILL.
 */
export interface ApplyTemplateRequest {
  weekStart: IsoDate;
  mode: ApplyMode;
  includeManual: boolean;
  confirmedDeleteIds: Uuid[] | null;
  confirmedRestoredIds: Uuid[] | null;
}

/** An occurrence the backend plans to create (not saved yet). */
export interface PlannedEvent {
  templateEventId: Uuid;
  title: string;
  description: string | null;
  start: IsoLocalDateTime;
  end: IsoLocalDateTime;
  participantIds: Uuid[];
  category: EventCategory;
  color: EventColor | null;
}

/** Will be created, but overlaps an existing event — a warning, not an error. */
export interface ApplyConflict {
  planned: PlannedEvent;
  existing: EventResponse;
}

/** T6 response — the backend's plan. The frontend only displays it (FD-84). */
export interface ApplyPreviewResponse {
  weekStart: IsoDate;
  mode: ApplyMode;
  toCreate: PlannedEvent[];
  /** The occurrence already exists (even if it was moved). */
  skippedAlreadyApplied: PlannedEvent[];
  /** MERGE / FILL: the user deleted this occurrence before. */
  skippedDeleted: PlannedEvent[];
  /** FILL: the participant's day is already busy. */
  skippedBusy: PlannedEvent[];
  /** REPLACE: subset of `toCreate` that brings back deleted occurrences. */
  restoredDeleted: PlannedEvent[];
  conflicts: ApplyConflict[];
  /** REPLACE: events that will be deleted. */
  toDelete: EventResponse[];
  /** Hint: manual events of the week that stay untouched. */
  manualEventsInWeek: number;
}

/**
 * A history record (T7 result, T8 list, `WeekResponse.appliedTemplates`,
 * `TemplateResponse.lastApplication`). `templateId: null` = template deleted;
 * `templateName` is a snapshot. skippedCount = alreadyApplied + deleted + busy.
 */
export interface TemplateApplicationResponse {
  id: Uuid;
  templateId: Uuid | null;
  templateName: string;
  weekStart: IsoDate;
  mode: ApplyMode;
  createdCount: number;
  skippedCount: number;
  deletedCount: number;
  appliedBy: Uuid;
  appliedAt: IsoInstant;
}

/** T7 response. */
export interface ApplyResultResponse {
  application: TemplateApplicationResponse;
  createdEvents: EventResponse[];
}
