// Test helpers for the timeline engine: specs and the board fixtures (fixtures.ts).
import type { Uuid } from '@core/api/models/common.models';
import { parseLocalDateTime } from '@shared/time/local-date-time';
import type { TimelineEvent } from '../engine/model';

/** Panel owners of the engine tests: A sits in seat 1, B in seat 2. */
export const A: Uuid = 'a0000000-0000-4000-8000-00000000000a';
export const B: Uuid = 'b0000000-0000-4000-8000-00000000000b';

let sequence = 0;

/**
 * `ev('2026-11-13T23:00', '2026-11-14T07:00', [A])` — an event in local date-times.
 * Ids are `e1`, `e2`, … in creation order unless given; the rest can be overridden.
 */
export function ev(
  start: string,
  end: string,
  participantIds: readonly Uuid[],
  overrides: Partial<TimelineEvent> = {},
): TimelineEvent {
  sequence += 1;
  return {
    id: `e${sequence}`,
    title: `Событие ${sequence}`,
    startMin: parseLocalDateTime(start),
    endMin: parseLocalDateTime(end),
    participantIds,
    category: 'OTHER',
    color: 'OTHER',
    joint: participantIds.length > 1,
    fromTemplate: false,
    ...overrides,
  };
}
