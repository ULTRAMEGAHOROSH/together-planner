import type { AuthResponse, LoginRequest, MeResponse, RegisterRequest } from './auth.models';
import type { PageResponse } from './common.models';
import type { EventRequest, EventResponse } from './event.models';
import type {
  ApplyPreviewResponse,
  ApplyResultResponse,
  ApplyTemplateRequest,
  PlannedEvent,
  TemplateApplicationResponse,
  TemplateEventRequest,
  TemplateRequest,
  TemplateResponse,
} from './template.models';
import type { WeekResponse } from './week.models';
import type {
  CreateWorkspaceRequest,
  InviteResponse,
  JoinWorkspaceRequest,
  MemberResponse,
  UpdateWorkspaceRequest,
  WorkspaceResponse,
} from './workspace.models';
import {
  APPLY_PREVIEW_MERGE,
  APPLY_PREVIEW_MERGE_AGAIN,
  APPLY_PREVIEW_REPLACE,
  APPLY_RESULT_MERGE,
  APPLY_RESULT_REPLACE,
  EVENT_CREATED_JOINT,
  EVENT_CREATED_MANUAL,
  EVENT_CROSS_WEEK,
  EVENT_UPCOMING_PAGE,
  EVENT_UPDATED,
  TEMPLATE_APPLICATIONS_PAGE,
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WEEK,
  WEEK_TEMPLATE_DELETED,
} from './testing/samples';

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

const EVENT_KEYS = [
  'id',
  'title',
  'description',
  'start',
  'end',
  'participantIds',
  'category',
  'color',
  'source',
  'createdBy',
  'updatedBy',
  'createdAt',
  'updatedAt',
  'version',
];
const PLANNED_KEYS = [
  'templateEventId',
  'title',
  'description',
  'start',
  'end',
  'participantIds',
  'category',
  'color',
];
const APPLICATION_KEYS = [
  'id',
  'templateId',
  'templateName',
  'weekStart',
  'mode',
  'createdCount',
  'skippedCount',
  'deletedCount',
  'appliedBy',
  'appliedAt',
];

const allEvents = (): EventResponse[] => [
  EVENT_CREATED_MANUAL,
  EVENT_CREATED_JOINT,
  EVENT_CROSS_WEEK,
  EVENT_UPDATED,
  ...EVENT_UPCOMING_PAGE.items,
  ...APPLY_RESULT_MERGE.createdEvents,
  ...APPLY_RESULT_REPLACE.createdEvents,
  ...APPLY_PREVIEW_REPLACE.toDelete,
  ...WEEK.events,
];
const templateEventIds = (events: readonly PlannedEvent[]) =>
  events.map((e) => e.templateEventId).sort();

// Samples are verbatim backend responses checked with `satisfies`. These tests pin
// the shape details the timeline, editor and apply dialog rely on.
describe('event / week / template models (spec §8.5–§8.9)', () => {
  it('EventResponse: all fields always present; manual event has explicit nulls', () => {
    for (const event of allEvents()) {
      expect(Object.keys(event)).toEqual(EVENT_KEYS);
    }
    expect(EVENT_CREATED_MANUAL.source).toBeNull();
    expect(EVENT_CREATED_MANUAL.description).toBeNull();
    expect(EVENT_CREATED_MANUAL.color).toBeNull(); // null = category color
    expect(EVENT_CREATED_JOINT.color).toBe('FOOD');
    expect(EVENT_CREATED_JOINT.participantIds).toHaveLength(2);
  });

  it('local date-times have seconds and no offset; instants are UTC with 0–9 fraction digits', () => {
    for (const event of allEvents()) {
      expect(event.start).toMatch(LOCAL_DATE_TIME);
      expect(event.end).toMatch(LOCAL_DATE_TIME);
      expect(event.createdAt).toMatch(INSTANT);
      expect(event.updatedAt).toMatch(INSTANT);
    }
    expect(TEMPLATE_CREATED.events.map((e) => e.startTime)).toEqual([
      '08:00:00',
      '07:00:00',
      '23:00:00',
    ]); // sent as "HH:mm", returned as "HH:mm:ss"
  });

  it('E5: update increments version', () => {
    expect(EVENT_CREATED_MANUAL.version).toBe(0);
    expect(EVENT_UPDATED.id).toBe(EVENT_CREATED_MANUAL.id);
    expect(EVENT_UPDATED.version).toBe(1);
  });

  it('WeekResponse: Monday…Sunday, members by seat, events by (start, id) incl. border-crossing', () => {
    expect(Object.keys(WEEK)).toEqual([
      'weekStart',
      'weekEnd',
      'timeZone',
      'members',
      'events',
      'appliedTemplates',
    ]);
    expect([WEEK.weekStart, WEEK.weekEnd, WEEK.timeZone]).toEqual([
      '2026-11-23',
      '2026-11-29',
      'Asia/Almaty',
    ]);
    expect(WEEK.members.map((m) => m.seat)).toEqual([1, 2]);
    const order = WEEK.events.map((e) => `${e.start}|${e.id}`);
    expect(order).toEqual([...order].sort());
    // The train ends on the next Monday: S1 returns it unclipped, the frontend clips.
    const train = WEEK.events.find((e) => e.id === EVENT_CROSS_WEEK.id);
    expect(train?.end).toBe('2026-11-30T06:00:00');
    expect(WEEK.appliedTemplates.map((a) => a.mode)).toEqual(['MERGE', 'REPLACE']);
  });

  it('events created from a template carry a source snapshot that survives template deletion', () => {
    for (const event of APPLY_RESULT_MERGE.createdEvents) {
      expect(event.source).toEqual({
        templateEventId: expect.any(String),
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      });
    }
    expect(WEEK_TEMPLATE_DELETED.appliedTemplates.map((a) => a.templateId)).toEqual([null, null]);
    expect(WEEK_TEMPLATE_DELETED.appliedTemplates.map((a) => a.templateName)).toEqual([
      'Обычная неделя',
      'Обычная неделя',
    ]);
    expect(WEEK_TEMPLATE_DELETED.events.filter((e) => e.source !== null)).toHaveLength(3);
  });

  it('TemplateResponse: events sorted by (dayOfWeek, startTime); lastApplication null until applied', () => {
    expect(Object.keys(TEMPLATE_CREATED)).toEqual([
      'id',
      'name',
      'description',
      'events',
      'lastApplication',
      'createdAt',
      'updatedAt',
      'version',
    ]);
    expect(TEMPLATE_CREATED.description).toBeNull();
    expect(TEMPLATE_CREATED.lastApplication).toBeNull();
    expect(TEMPLATE_CREATED.events.map((e) => e.dayOfWeek)).toEqual([
      'MONDAY',
      'TUESDAY',
      'SUNDAY',
    ]);
    expect(Object.keys(TEMPLATE_CREATED.events[0])).toEqual([
      'id',
      'title',
      'description',
      'dayOfWeek',
      'startTime',
      'durationMinutes',
      'participantIds',
      'category',
      'color',
    ]);
    expect(TEMPLATE_WITH_LAST_APPLICATION.lastApplication?.id).toBe(
      APPLY_RESULT_REPLACE.application.id,
    );
  });

  it('ApplyPreviewResponse: every list is present (empty, not missing)', () => {
    const keys = [
      'weekStart',
      'mode',
      'toCreate',
      'skippedAlreadyApplied',
      'skippedDeleted',
      'skippedBusy',
      'restoredDeleted',
      'conflicts',
      'toDelete',
      'manualEventsInWeek',
    ];
    for (const preview of [APPLY_PREVIEW_MERGE, APPLY_PREVIEW_MERGE_AGAIN, APPLY_PREVIEW_REPLACE]) {
      expect(Object.keys(preview)).toEqual(keys);
      for (const planned of [...preview.toCreate, ...preview.skippedAlreadyApplied]) {
        expect(Object.keys(planned)).toEqual(PLANNED_KEYS);
      }
    }
    expect(Object.keys(APPLY_PREVIEW_MERGE.conflicts[0])).toEqual(['planned', 'existing']);
  });

  it('MERGE preview: conflicts are warnings; re-applying skips applied and deleted occurrences', () => {
    expect(APPLY_PREVIEW_MERGE.toCreate).toHaveLength(3);
    expect(APPLY_PREVIEW_MERGE.conflicts).toHaveLength(1);
    expect(APPLY_PREVIEW_MERGE.conflicts[0].existing.id).toBe(EVENT_CREATED_MANUAL.id);
    expect(APPLY_PREVIEW_MERGE.manualEventsInWeek).toBe(4);
    expect(APPLY_PREVIEW_MERGE_AGAIN.toCreate).toEqual([]);
    expect(APPLY_PREVIEW_MERGE_AGAIN.skippedAlreadyApplied).toHaveLength(2);
    expect(APPLY_PREVIEW_MERGE_AGAIN.skippedDeleted.map((p) => p.title)).toEqual(['Пробежка']);
  });

  it('REPLACE preview: restoredDeleted ⊂ toCreate, toDelete are template events, conflicts with manual', () => {
    const p = APPLY_PREVIEW_REPLACE;
    expect(p.toDelete).toHaveLength(2);
    expect(p.restoredDeleted).toHaveLength(1);
    expect(p.conflicts).toHaveLength(1);
    const created = templateEventIds(p.toCreate);
    for (const id of templateEventIds(p.restoredDeleted)) {
      expect(created).toContain(id);
    }
    expect(p.toDelete.every((e) => e.source !== null)).toBe(true); // includeManual: false
    expect(p.conflicts[0].existing.source).toBeNull();
  });

  it('ApplyResultResponse: counters match the preview; createdEvents are full events', () => {
    expect(Object.keys(APPLY_RESULT_MERGE)).toEqual(['application', 'createdEvents']);
    const merge = APPLY_RESULT_MERGE.application;
    expect(Object.keys(merge)).toEqual(APPLICATION_KEYS);
    expect([merge.mode, merge.createdCount, merge.skippedCount, merge.deletedCount]).toEqual([
      'MERGE',
      3,
      0,
      0,
    ]);
    expect(APPLY_RESULT_MERGE.createdEvents).toHaveLength(merge.createdCount);
    const replace = APPLY_RESULT_REPLACE.application;
    expect(replace.createdCount).toBe(APPLY_PREVIEW_REPLACE.toCreate.length);
    expect(replace.deletedCount).toBe(APPLY_PREVIEW_REPLACE.toDelete.length);
    expect(replace.appliedAt).toMatch(INSTANT);
  });

  it('PageResponse: E2 and T8 pages share one shape', () => {
    const keys = ['items', 'page', 'size', 'totalElements', 'totalPages', 'hasNext'];
    expect(Object.keys(EVENT_UPCOMING_PAGE)).toEqual(keys);
    expect(Object.keys(TEMPLATE_APPLICATIONS_PAGE)).toEqual(keys);
    expect(TEMPLATE_APPLICATIONS_PAGE).toMatchObject({ size: 1, totalElements: 2, hasNext: true });
    expect(Object.keys(TEMPLATE_APPLICATIONS_PAGE.items[0])).toEqual(APPLICATION_KEYS);
  });

  it('request types follow the contract (compile-time)', () => {
    const create: EventRequest = {
      title: 'Работа',
      description: null,
      start: '2026-11-23T09:00:00',
      end: '2026-11-23T18:00:00',
      participantIds: [EVENT_CREATED_MANUAL.createdBy],
      category: 'WORK',
      color: null,
    };
    const update: EventRequest = { ...create, version: EVENT_CREATED_MANUAL.version };
    // @ts-expect-error — color is required (null = category color)
    const noColor: EventRequest = { ...create, color: undefined };
    // @ts-expect-error — unknown category
    const badCategory: EventRequest = { ...create, category: 'WORKOUT' };
    const templateEvent: TemplateEventRequest = {
      id: null,
      title: 'Пробежка',
      description: null,
      dayOfWeek: 'TUESDAY',
      startTime: '07:00',
      durationMinutes: 60,
      participantIds: [],
      category: 'SPORT',
      color: null,
    };
    // @ts-expect-error — id must be sent (null for a new event), never omitted
    const noId: TemplateEventRequest = { ...templateEvent, id: undefined };
    const template: TemplateRequest = {
      name: 'Неделя',
      description: null,
      events: [templateEvent],
    };
    const preview: ApplyTemplateRequest = {
      weekStart: '2026-11-23',
      mode: 'REPLACE',
      includeManual: false,
      confirmedDeleteIds: null,
      confirmedRestoredIds: null,
    };
    // @ts-expect-error — unknown mode
    const badMode: ApplyTemplateRequest = { ...preview, mode: 'OVERWRITE' };
    expect([create, update, noColor, badCategory, noId, template, preview, badMode]).toHaveLength(
      8,
    );
  });
});

// One request/response pair per endpoint of spec §8.1 (void = no body / 204).
interface ApiContract {
  A1: [RegisterRequest, AuthResponse];
  A2: [LoginRequest, AuthResponse];
  A3: [void, AuthResponse];
  A4: [void, void];
  A5: [void, void];
  A6: [void, MeResponse];
  W1: [CreateWorkspaceRequest, WorkspaceResponse];
  W2: [void, WorkspaceResponse];
  W3: [UpdateWorkspaceRequest, WorkspaceResponse];
  W4: [void, MemberResponse[]];
  W5: [void, InviteResponse];
  W6: [JoinWorkspaceRequest, WorkspaceResponse];
  S1: [void, WeekResponse];
  E1: [void, EventResponse[]];
  E2: [void, PageResponse<EventResponse>];
  E3: [EventRequest, EventResponse];
  E4: [void, EventResponse];
  E5: [EventRequest, EventResponse];
  E6: [void, void];
  T1: [void, TemplateResponse[]];
  T2: [TemplateRequest, TemplateResponse];
  T3: [void, TemplateResponse];
  T4: [TemplateRequest, TemplateResponse];
  T5: [void, void];
  T6: [ApplyTemplateRequest, ApplyPreviewResponse];
  T7: [ApplyTemplateRequest, ApplyResultResponse];
  T8: [void, PageResponse<TemplateApplicationResponse>];
}

describe('API contract coverage', () => {
  it('all 27 endpoints of spec §8.1 have request and response types', () => {
    // prettier-ignore
    const ids = {
      A1: 1, A2: 1, A3: 1, A4: 1, A5: 1, A6: 1,
      W1: 1, W2: 1, W3: 1, W4: 1, W5: 1, W6: 1,
      S1: 1,
      E1: 1, E2: 1, E3: 1, E4: 1, E5: 1, E6: 1,
      T1: 1, T2: 1, T3: 1, T4: 1, T5: 1, T6: 1, T7: 1, T8: 1,
    } satisfies Record<keyof ApiContract, 1>; // missing or extra ids fail compilation
    expect(Object.keys(ids)).toHaveLength(27);
  });
});
