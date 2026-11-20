import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { EventResponse } from '@core/api/models/event.models';
import {
  AUTH_RESPONSE,
  EVENT_CREATED_MANUAL,
  PROBLEM_MALFORMED,
  PROBLEM_WORKSPACE_NOT_FOUND,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { CLOCK } from '@core/time/zone-clock';
import { UPCOMING_LIMIT, UpcomingStore } from './upcoming-store';

const URL = (from: string, to: string) =>
  `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/events?from=${from}&to=${to}`;
// Thursday 12.11.2026 14:20 in Asia/Almaty (09:20 UTC); 93 days: 12.11.2026 … 12.02.2027.
const RANGE = URL('2026-11-12', '2027-02-12');
let now = Date.UTC(2026, 10, 12, 9, 20);

const event = (id: string, start: string, end: string, over: Partial<EventResponse> = {}) =>
  ({ ...EVENT_CREATED_MANUAL, id, start, end, ...over }) satisfies EventResponse;
const fromTemplate = (id: string, start: string, end: string) =>
  event(id, start, end, {
    source: { templateEventId: 'te', weekStart: '2026-11-09', templateName: 'Будни' },
  });

describe('UpcomingStore (CAL-02)', () => {
  let store: UpcomingStore;
  let backend: HttpTestingController;
  const workspaceNotFound = vi.fn();

  beforeEach(() => {
    now = Date.UTC(2026, 10, 12, 9, 20);
    workspaceNotFound.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        UpcomingStore,
        { provide: CLOCK, useValue: () => now },
        { provide: WorkspaceRefresh, useValue: { workspaceNotFound } },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(UpcomingStore);
  });

  afterEach(() => backend.verify());

  const load = async (events: EventResponse[]) => {
    TestBed.tick();
    backend.expectOne(RANGE).flush(events);
  };

  it('loads itself: E1 from today for 93 days', async () => {
    expect(store.status()).toBe('loading');
    expect(store.events()).toEqual([]);
    expect(store.today()).toBe('2026-11-12');
    await load([]);
    expect(store.status()).toBe('ready');
    expect(store.error()).toBeNull();
  });

  it('only manual events: the ones from templates stay out', async () => {
    await load([
      fromTemplate('t', '2026-11-13T09:00:00', '2026-11-13T18:00:00'),
      event('m', '2026-11-14T10:00:00', '2026-11-14T11:00:00'),
    ]);
    expect(store.events().map((e) => e.id)).toEqual(['m']);
  });

  it('only what has not ended: a finished event of today is out, a running one stays', async () => {
    // Now is 14:20 in the zone of the workspace.
    await load([
      event('done', '2026-11-12T09:00:00', '2026-11-12T10:00:00'),
      event('running', '2026-11-12T14:00:00', '2026-11-12T15:00:00'),
      event('overnight', '2026-11-11T22:00:00', '2026-11-13T06:00:00'),
      event('later', '2026-11-12T20:00:00', '2026-11-12T21:00:00'),
    ]);
    expect(store.events().map((e) => e.id)).toEqual(['running', 'overnight', 'later']);
  });

  it('an event that ends exactly now is over (the end is exclusive)', async () => {
    await load([event('edge', '2026-11-12T13:00:00', '2026-11-12T14:20:00')]);
    expect(store.events()).toEqual([]);
  });

  it('the first eight, in the order the server gave', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      event(
        `e${i}`,
        `2026-11-${String(13 + i).padStart(2, '0')}T10:00:00`,
        `2026-11-${String(13 + i).padStart(2, '0')}T11:00:00`,
      ),
    );
    await load(many);
    expect(UPCOMING_LIMIT).toBe(8);
    expect(store.events().map((e) => e.id)).toEqual(many.slice(0, 8).map((e) => e.id));
  });

  it('template events do not use up the eight places', async () => {
    const routine = Array.from({ length: 10 }, (_, i) =>
      fromTemplate(`r${i}`, `2026-11-13T0${i % 9}:00:00`, `2026-11-13T0${i % 9}:30:00`),
    );
    await load([...routine, event('m', '2026-11-20T10:00:00', '2026-11-20T11:00:00')]);
    expect(store.events().map((e) => e.id)).toEqual(['m']);
  });

  it('reads again after the events changed', async () => {
    await load([]);
    TestBed.inject(DataChanges).eventsChanged();
    backend.expectOne(RANGE).flush([event('m', '2026-11-14T10:00:00', '2026-11-14T11:00:00')]);
    expect(store.events().map((e) => e.id)).toEqual(['m']);
    expect(store.status()).toBe('ready');
  });

  it('an error, then a retry recovers', async () => {
    TestBed.tick();
    backend.expectOne(RANGE).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('MALFORMED_REQUEST');

    store.reload();
    expect(store.status()).toBe('loading');
    backend.expectOne(RANGE).flush([]);
    expect(store.status()).toBe('ready');
    expect(store.error()).toBeNull();
  });

  it('an error on a reload keeps what was on screen', async () => {
    await load([event('m', '2026-11-14T10:00:00', '2026-11-14T11:00:00')]);
    store.reload();
    backend.expectOne(RANGE).error(new ProgressEvent('error'));
    expect(store.status()).toBe('error');
    expect(store.events()).toHaveLength(1);
  });

  it('404 WORKSPACE_NOT_FOUND → the common handler of WS-07', async () => {
    TestBed.tick();
    backend
      .expectOne(RANGE)
      .flush(PROBLEM_WORKSPACE_NOT_FOUND, { status: 404, statusText: 'Not Found' });
    expect(store.error()?.code).toBe('WORKSPACE_NOT_FOUND');
    expect(workspaceNotFound).toHaveBeenCalledOnce();
  });
});
