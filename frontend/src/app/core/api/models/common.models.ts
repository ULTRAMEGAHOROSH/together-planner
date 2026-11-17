// Shared API types. Source: docs/backend-spec-v2.md §7.1 (errors), §8.0 (formats), §8.2 (PageResponse).
// Rules: FD-20…23 — interfaces 1:1 with backend DTOs, date-times stay strings, never Date.
import type { ErrorCode } from './error-codes';

/** UUID as sent by the backend: "7f0c1e2a-…". */
export type Uuid = string;
/** java.time.LocalDate: "2026-11-20". */
export type IsoDate = string;
/** java.time.LocalTime: "08:00:00" in responses; requests may send "08:00". */
export type IsoTime = string;
/** java.time.LocalDateTime in the workspace zone, no offset: "2026-11-20T08:00:00". */
export type IsoLocalDateTime = string;
/** java.time.Instant, UTC: "2026-11-12T09:15:30Z". */
export type IsoInstant = string;

/** spec §8.2 — PageResponse<T>. `page` is zero-based. */
export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

/** spec §7.1 — one entry of `errors[]` (Bean Validation, VALIDATION_FAILED only). */
export interface ValidationErrorItem {
  field: string;
  message: string;
}

/**
 * spec §7.1 — RFC 9457 ProblemDetail with the project's `code` extension.
 * `code` is always present. The backend (Spring 7) omits `type` when it is
 * "about:blank", so `type`, `detail` and `instance` are optional. `detail` is a
 * technical text: the UI shows its own message for `code` (FD-67).
 */
export interface ProblemDetail {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: ErrorCode;
  errors?: ValidationErrorItem[];
}
