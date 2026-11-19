import type { EventResponse } from '@core/api/models/event.models';
import {
  EVENT_CREATED_JOINT,
  EVENT_CREATED_MANUAL,
  EVENT_CROSS_WEEK,
  EVENT_UPCOMING_PAGE,
} from '@core/api/models/testing/samples';
import { formatLocalDateTime, parseLocalDateTime } from '@shared/time/local-date-time';
import { toTimelineEvent, toTimelineEvents } from './to-timeline-events';

describe('toTimelineEvents (WEEK-01)', () => {
  it('manual, one participant: local minutes, category color, not joint, not from a template', () => {
    expect(toTimelineEvent(EVENT_CREATED_MANUAL)).toEqual({
      id: EVENT_CREATED_MANUAL.id,
      title: 'Работа',
      startMin: parseLocalDateTime('2026-11-23T09:00'),
      endMin: parseLocalDateTime('2026-11-23T18:00'),
      participantIds: EVENT_CREATED_MANUAL.participantIds,
      category: 'WORK',
      color: 'WORK',
      joint: false,
      fromTemplate: false,
    });
  });

  it('the minutes are wall-clock time: 9 hours apart, seconds of the DTO dropped', () => {
    const event = toTimelineEvent(EVENT_CREATED_MANUAL);
    expect(event.endMin - event.startMin).toBe(9 * 60);
    expect(formatLocalDateTime(event.startMin)).toBe('2026-11-23T09:00');
  });

  it('two participants → joint; an own color wins over the category (FD-62)', () => {
    const event = toTimelineEvent(EVENT_CREATED_JOINT);
    expect(event.joint).toBe(true);
    expect(event.category).toBe('TOGETHER');
    expect(event.color).toBe('FOOD');
  });

  it('through midnight and the end of the week: both ends kept as they are', () => {
    const event = toTimelineEvent(EVENT_CROSS_WEEK);
    expect(formatLocalDateTime(event.startMin)).toBe('2026-11-29T22:00');
    expect(formatLocalDateTime(event.endMin)).toBe('2026-11-30T06:00');
    expect(event.endMin - event.startMin).toBe(8 * 60);
  });

  it('an occurrence of a template (source set) → fromTemplate', () => {
    const fromTemplate = EVENT_UPCOMING_PAGE.items.find((e) => e.source !== null)!;
    expect(toTimelineEvent(fromTemplate).fromTemplate).toBe(true);
  });

  it('maps the list in order, without touching the DTOs', () => {
    const events: EventResponse[] = [EVENT_CROSS_WEEK, EVENT_CREATED_JOINT];
    const before = structuredClone(events);
    const mapped = toTimelineEvents(events);
    expect(mapped.map((e) => e.id)).toEqual([EVENT_CROSS_WEEK.id, EVENT_CREATED_JOINT.id]);
    expect(mapped[1].participantIds).not.toBe(EVENT_CREATED_JOINT.participantIds);
    expect(events).toEqual(before);
    expect(toTimelineEvents([])).toEqual([]);
  });
});
