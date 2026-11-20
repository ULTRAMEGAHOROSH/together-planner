// «Сохранить неделю как шаблон» (TPL-12, decision OQ-3): the week as a T2 body. The backend has
// no endpoint for it, so the client builds the request — and says what it left out.
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import { DAYS_OF_WEEK } from '@core/api/models/enums';
import type { EventResponse } from '@core/api/models/event.models';
import type { TemplateRequest } from '@core/api/models/template.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { TEMPLATE_DURATION_MAX, TEMPLATE_EVENTS_MAX } from '@shared/domain/event-constraints';
import { DAY_MINUTES, weekLabel, weekShort } from '@shared/time';
import {
  formatTime,
  minutesOfDay,
  parseDate,
  parseLocalDateTime,
} from '@shared/time/local-date-time';

/** Why an event of the week is not in the template. */
export type SkipReason = 'startedEarlier' | 'noParticipants' | 'noLength';

export interface SkippedEvent {
  readonly title: string;
  readonly reason: SkipReason;
}

/** An event longer than a week: it is in the template, cut to one week. */
export interface ClampedEvent {
  readonly title: string;
}

export interface WeekTemplateDraft {
  /** The T2 body; `null` when the template would be over the limit (`tooMany`). */
  readonly request: TemplateRequest | null;
  /** Events in the template. */
  readonly count: number;
  readonly skipped: readonly SkippedEvent[];
  readonly clamped: readonly ClampedEvent[];
  /** More than 300 events: the template is not built, the user is told the number. */
  readonly tooMany: boolean;
}

/** «Неделя 9–15 нояб. 2026»: with the year, so the next year's week is another name. */
export function defaultTemplateName(weekStart: IsoDate): string {
  return `Неделя ${weekShort(weekStart)} ${weekStart.slice(0, 4)}`;
}

/**
 * The rule of OQ-3, the same for every week:
 * - an event belongs to the week where it **starts** (`[Mon, next Mon)`); one that started
 *   earlier is the previous week's and is skipped (and named), because S1 returns whole
 *   events, not pieces cut at the border;
 * - events made from templates are taken like any other: the template stores no source,
 *   so «apply → tweak → save» does not lose half of the week;
 * - the length stays, up to one week (10080); a longer event is cut and named;
 * - people who are no longer in the workspace are dropped from an event; with nobody left
 *   the event is skipped and named;
 * - over 300 events the template is not built (nothing is cut silently).
 * Display of what was left out is the caller's: this function only says it.
 */
export function weekToTemplate(
  weekStart: IsoDate,
  events: readonly EventResponse[],
  members: readonly MemberResponse[],
  name: string = defaultTemplateName(weekStart),
): WeekTemplateDraft {
  const from = parseDate(weekStart);
  const to = from + 7 * DAY_MINUTES;
  const seatOrder = [...members].sort((a, b) => a.seat - b.seat).map((m) => m.userId);
  const skipped: SkippedEvent[] = [];
  const clamped: ClampedEvent[] = [];
  const taken: TemplateRequest['events'] = [];

  const ordered = [...events].sort(
    (a, b) => parseLocalDateTime(a.start) - parseLocalDateTime(b.start),
  );
  for (const event of ordered) {
    const start = parseLocalDateTime(event.start);
    if (start >= to) continue;
    if (start < from) {
      skipped.push({ title: event.title, reason: 'startedEarlier' });
      continue;
    }
    const participantIds: Uuid[] = seatOrder.filter((id) => event.participantIds.includes(id));
    if (participantIds.length === 0) {
      skipped.push({ title: event.title, reason: 'noParticipants' });
      continue;
    }
    const length = parseLocalDateTime(event.end) - start;
    if (length < 1) {
      skipped.push({ title: event.title, reason: 'noLength' });
      continue;
    }
    if (length > TEMPLATE_DURATION_MAX) clamped.push({ title: event.title });
    taken.push({
      id: null,
      title: event.title,
      description: event.description,
      dayOfWeek: DAYS_OF_WEEK[Math.floor((start - from) / DAY_MINUTES)],
      startTime: formatTime(minutesOfDay(start)),
      durationMinutes: Math.min(length, TEMPLATE_DURATION_MAX),
      participantIds,
      category: event.category,
      color: event.color,
    });
  }

  const tooMany = taken.length > TEMPLATE_EVENTS_MAX;
  return {
    request: tooMany
      ? null
      : {
          name,
          description: `Создан из недели ${weekLabel(weekStart)}`,
          events: taken,
        },
    count: taken.length,
    skipped,
    clamped,
    tooMany,
  };
}
