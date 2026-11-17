// Week DTO (S1). Source: docs/backend-spec-v2.md §8.5 (backend: schedule/dto/WeekResponse.java).
// Clipping events to the week and splitting them by day is done by the frontend
// (shared/timeline/engine).
import type { IsoDate } from './common.models';
import type { EventResponse } from './event.models';
import type { TemplateApplicationResponse } from './template.models';
import type { MemberResponse } from './workspace.models';

export interface WeekResponse {
  /** Monday. */
  weekStart: IsoDate;
  /** Sunday, inclusive. */
  weekEnd: IsoDate;
  timeZone: string;
  /** Sorted by seat. */
  members: MemberResponse[];
  /** Events overlapping the week (including those crossing its borders), sorted by (start, id). */
  events: EventResponse[];
  /** Applications with this weekStart, sorted by appliedAt. */
  appliedTemplates: TemplateApplicationResponse[];
}
