// Enumerations of the API. Source: docs/backend-spec-v2.md §5.6 (enums), §8.0 (DayOfWeek).
// FD-21: string unions derived from `as const` arrays — no TS enums, no runtime mapping.

/** spec §5.6 WorkspaceRole. */
export const WORKSPACE_ROLES = ['OWNER', 'MEMBER'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** spec §5.6 EventCategory. */
export const EVENT_CATEGORIES = [
  'WORK',
  'SLEEP',
  'FOOD',
  'COMMUTE',
  'SPORT',
  'REST',
  'TOGETHER',
  'TRIP',
  'OTHER',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/**
 * spec §5.6 EventColor — a palette key with the same values as EventCategory.
 * `color: null` on an event means "same as the category" (spec §5.3).
 */
export const EVENT_COLORS = [
  'WORK',
  'SLEEP',
  'FOOD',
  'COMMUTE',
  'SPORT',
  'REST',
  'TOGETHER',
  'TRIP',
  'OTHER',
] as const;
export type EventColor = (typeof EVENT_COLORS)[number];

/** spec §5.6 ApplyMode (template application, §8.8). */
export const APPLY_MODES = ['MERGE', 'FILL', 'REPLACE'] as const;
export type ApplyMode = (typeof APPLY_MODES)[number];

/** java.time.DayOfWeek as JSON (spec §8.0), ISO order: Monday first. */
export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
