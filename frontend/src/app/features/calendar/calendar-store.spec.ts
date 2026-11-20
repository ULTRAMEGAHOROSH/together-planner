import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { EventResponse } from '@core/api/models/event.models';
import {
  AUTH_RESPONSE,
  EVENT_CREATED_JOINT,
  EVENT_CREATED_MANUAL,
  EVENT_CROSS_WEEK,
  PROBLEM_MALFORMED,
  PROBLEM_WORKSPACE_NOT_FOUND,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { CLOCK } from '@core/time/zone-clock';
import { daysBetween } from '@shared/time';
import { CalendarStore } from './calendar-store';

const URL = (from: string, to: string) =>
  `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/events?from=${from}&to=${to}`;
// November 2026: six weeks, from Monday 26.10 to Sunday 06.12.
const NOVEMBER = URL('2026-10-26', '2026-12-06');
const DECEMBER = URL('2026-11-30', '2027-01-03');
// Wednesday 25.11 14:20 in Asia/Almaty (09:20 UTC).
const NOW = Date.UTC(2026, 10, 25, 9, 20);

const event = (over: Partial<EventResponse>): EventResponse => ({
  ...EVENT_CREATED_MANUAL,
  ...over,
});
const routine = (id: string, start: string): EventResponse =>
  event({
    id,
    start,
    end: start,
    source: { templateEventId: 'te', weekStart: '2026-11-23', templateName: 'Будни' },
  });

describe('CalendarStore (CAL-01)', () => {
  let store: CalendarStore;
  let backend: HttpTestingController;
  const workspaceNotFound = vi.fn();

  beforeEach(() => {
    workspaceNotFound.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        CalendarStore,
        { provide: CLOCK, useValue: () => NOW },
        { provide: WorkspaceRefresh, useValue: { workspaceNotFound } },
      ],
    });
    store = TestBed.inject(CalendarStore);
    backend = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
  });

  afterEach(() => backend.verify());

  const show = (events: EventResponse[]) => {
    store.showMonth('2026-11');
    backend.expectOne(NOVEMBER).flush(events);
  };
  const day = (date: string) => store.days().find((d) => d.date === date);

  it('starts idle: nothing asked, nothing shown', () => {
    expect(store.status()).toBe('idle');
    expect(store.month()).toBeNull();
    expect(store.days()).toEqual([]);
    store.reload();
    backend.expectNone(() => true);
  });

  it('asks E1 for the days of the grid, at most 93 of them', () => {
    store.showMonth('2026-11');
    expect(store.status()).toBe('loading');
    expect(store.month()).toBe('2026-11');
    const request = backend.expectOne(NOVEMBER);
    const { from, to } = {
      from: request.request.params.get('from')!,
      to: request.request.params.get('to')!,
    };
    expect(daysBetween(from, to)).toBe(41);
    request.flush([]);
    expect(store.status()).toBe('ready');
  });

  it('the cells: the grid of the month, «today» in the zone of the workspace', () => {
    show([]);
    const days = store.days();
    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ date: '2026-10-26', number: 26, inMonth: false });
    expect(day('2026-11-01')).toMatchObject({ number: 1, inMonth: true });
    expect(day('2026-12-06')?.inMonth).toBe(false);
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-11-25']);
  });

  it('manual events go to the day they start, by start time; template ones are only counted', () => {
    show([
      event({ id: 'b', start: '2026-11-23T18:00:00', end: '2026-11-23T19:00:00' }),
      event({ id: 'a', start: '2026-11-23T09:00:00', end: '2026-11-23T10:00:00' }),
      routine('r1', '2026-11-23T07:00:00'),
      routine('r2', '2026-11-23T08:00:00'),
      EVENT_CREATED_JOINT,
    ]);
    expect(day('2026-11-23')?.manual.map((e) => e.id)).toEqual(['a', 'b']);
    expect(day('2026-11-23')?.routine).toBe(2);
    expect(day('2026-11-25')?.manual.map((e) => e.id)).toEqual([EVENT_CREATED_JOINT.id]);
    expect(day('2026-11-24')).toMatchObject({ manual: [], routine: 0 });
  });

  it('an event over midnight is in the day it began only', () => {
    show([EVENT_CROSS_WEEK]); // Sunday 29.11 22:00 → Monday 30.11 06:00
    expect(day('2026-11-29')?.manual).toHaveLength(1);
    expect(day('2026-11-30')?.manual).toHaveLength(0);
  });

  it('an event that began before the grid is in no cell', () => {
    show([event({ id: 'old', start: '2026-10-20T10:00:00', end: '2026-10-27T10:00:00' })]);
    expect(store.days().flatMap((d) => d.manual)).toEqual([]);
  });

  it('keeps the previous month on screen while the next one loads', () => {
    show([EVENT_CREATED_MANUAL]);
    store.showMonth('2026-12');
    expect(store.status()).toBe('loading');
    expect(store.days()[0].date).toBe('2026-10-26');
    backend.expectOne(DECEMBER).flush([]);
    expect(store.days()[0].date).toBe('2026-11-30');
    expect(store.days()).toHaveLength(35);
  });

  it('a newer request cancels the older one', () => {
    store.showMonth('2026-11');
    const first = backend.expectOne(NOVEMBER);
    store.showMonth('2026-12');
    backend.expectOne(DECEMBER).flush([]);
    expect(first.cancelled).toBe(true);
    expect(store.days()[0].date).toBe('2026-11-30');
  });

  it('reads again after the events changed', () => {
    show([]);
    TestBed.inject(DataChanges).eventsChanged();
    backend.expectOne(NOVEMBER).flush([EVENT_CREATED_MANUAL]);
    expect(day('2026-11-23')?.manual).toHaveLength(1);
  });

  it('eventById gives the event of the loaded month with its version', () => {
    show([EVENT_CREATED_MANUAL]);
    expect(store.eventById(EVENT_CREATED_MANUAL.id)?.version).toBe(0);
    expect(store.eventById('nope')).toBeUndefined();
  });

  it('an error: the data of another month is dropped, a retry recovers', () => {
    show([EVENT_CREATED_MANUAL]);
    store.showMonth('2026-12');
    backend.expectOne(DECEMBER).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('MALFORMED_REQUEST');
    expect(store.days()).toEqual([]);

    store.reload();
    backend.expectOne(DECEMBER).flush([]);
    expect(store.status()).toBe('ready');
    expect(store.error()).toBeNull();
  });

  it('an error on the reload of the same month keeps that month', () => {
    show([EVENT_CREATED_MANUAL]);
    store.reload();
    backend.expectOne(NOVEMBER).error(new ProgressEvent('error'));
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('NETWORK_ERROR');
    expect(store.days()).toHaveLength(42);
  });

  it('404 WORKSPACE_NOT_FOUND → error and the common handler of WS-07', () => {
    store.showMonth('2026-11');
    backend
      .expectOne(NOVEMBER)
      .flush(PROBLEM_WORKSPACE_NOT_FOUND, { status: 404, statusText: 'Not Found' });
    expect(store.error()?.code).toBe('WORKSPACE_NOT_FOUND');
    expect(workspaceNotFound).toHaveBeenCalledOnce();
  });
});
