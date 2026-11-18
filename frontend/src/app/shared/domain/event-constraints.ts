// Input limits of the backend, repeated on the client for UX only: the backend
// stays the final check (FD-82). Source: docs/backend-spec-v2.md and backend/**/dto/*.java.
// Lengths are in UTF-16 code units, like Java `@Size` on a String and JS `string.length`.

// --- Events (spec §8.6 EventRequest, §9.7 EventValidator) ---

/** `title` after trim: 1..100. */
export const EVENT_TITLE_MAX = 100;
/** `description` ≤ 2000 (events and template events). */
export const EVENT_DESCRIPTION_MAX = 2000;
/** `end − start` ≤ 31 days by local clock; exactly 31 days is allowed (`EVENT_TOO_LONG`). */
export const EVENT_MAX_DURATION_MINUTES = 31 * 24 * 60;
/** Year of `start` in 2000..2100 (`EVENT_DATE_OUT_OF_RANGE`). */
export const EVENT_YEAR_MIN = 2000;
export const EVENT_YEAR_MAX = 2100;
/** `participantIds`: 1..2 members of the workspace. */
export const PARTICIPANTS_MIN = 1;
export const PARTICIPANTS_MAX = 2;
/** E1 `from..to` inclusive ≤ 93 days (`INVALID_DATE_RANGE`): a 6-week month grid fits. */
export const EVENT_RANGE_MAX_DAYS = 93;

// --- Templates (spec §8.7 TemplateRequest, TemplateEventRequest) ---

/** Template `name` after trim: 1..60, unique in the workspace. */
export const TEMPLATE_NAME_MAX = 60;
/** Template `description` ≤ 500. */
export const TEMPLATE_DESCRIPTION_MAX = 500;
/** `events` ≤ 300. */
export const TEMPLATE_EVENTS_MAX = 300;
/** Template event `durationMinutes`: 1..10080 (one week). Title and description as for events. */
export const TEMPLATE_DURATION_MIN = 1;
export const TEMPLATE_DURATION_MAX = 10080;

// --- Workspace (spec §8.4) ---

/** Workspace `name` after trim: 1..60. */
export const WORKSPACE_NAME_MAX = 60;
/** IANA `timeZone` id ≤ 64. */
export const TIME_ZONE_MAX = 64;
/** Invite `code` as typed ≤ 20 (case and dash are normalized by the backend). */
export const INVITE_CODE_MAX = 20;

// --- Account (spec §8.3, §10.2) ---

/** `displayName` after trim: 1..50. */
export const DISPLAY_NAME_MAX = 50;
/** `email` ≤ 254. */
export const EMAIL_MAX = 254;
/** Password: 8..72 characters and ≤ 72 bytes in UTF-8 (BCrypt limit, `PASSWORD_TOO_LONG`). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export const PASSWORD_MAX_BYTES = 72;

// --- Paging (E2, T8) ---

/** `size` query parameter: 1..100. */
export const PAGE_SIZE_MAX = 100;

/** Length in UTF-8 bytes, as the backend counts it for the password limit. */
export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}
