import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_RESPONSE,
  PROBLEM_MALFORMED,
  PROBLEM_WORKSPACE_NOT_FOUND,
  WEEK,
  WEEK_TEMPLATE_DELETED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import type { WeekResponse } from '@core/api/models/week.models';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { CLOCK } from '@core/time/zone-clock';
import { WeekPanel, WeekStore } from './week-store';

const URL = (date: string) => `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/week?date=${date}`;
const WEEK_23 = '2026-11-23';
const WEEK_16 = '2026-11-16';
// Wednesday 25.11 14:20 in Asia/Almaty (09:20 UTC).
const NOW = Date.UTC(2026, 10, 25, 9, 20);
const DAULET = WEEK.members[0].userId;
const AIGERIM = WEEK.members[1].userId;

const emptyWeek = (weekStart: string): WeekResponse => ({
  ...WEEK,
  weekStart,
  weekEnd: weekStart,
  events: [],
  appliedTemplates: [],
});

describe('WeekStore (WEEK-09)', () => {
  let store: WeekStore;
  let backend: HttpTestingController;
  let session: SessionStore;
  const workspaceNotFound = vi.fn();

  beforeEach(() => {
    workspaceNotFound.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        WeekStore,
        { provide: CLOCK, useValue: () => NOW },
        { provide: WorkspaceRefresh, useValue: { workspaceNotFound } },
      ],
    });
    store = TestBed.inject(WeekStore);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
  });

  afterEach(() => backend.verify());

  const member = (panel: WeekPanel | undefined) => {
    if (panel?.kind !== 'member') {
      throw new Error('not a member panel');
    }
    return panel.panel;
  };

  it('starts idle: nothing asked, nothing shown', () => {
    expect(store.status()).toBe('idle');
    expect(store.weekStart()).toBeNull();
    expect(store.data()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.periodLabel()).toBe('');
    expect(store.panels()).toEqual([]);
    expect(store.today()).toBeNull();
    expect(store.timeZone()).toBeNull();
    expect(store.appliedTemplates()).toEqual([]);
    expect(store.isEmpty()).toBe(false);
    store.reload(); // nothing to reload
    backend.expectNone(() => true);
  });

  it('setWeek: loading with the label at once, ready with the data after S1', () => {
    store.setWeek(WEEK_23);
    expect(store.status()).toBe('loading');
    expect(store.periodLabel()).toBe('23 – 29 ноября 2026');
    expect(store.data()).toBeNull();

    backend.expectOne(URL(WEEK_23)).flush(WEEK);
    expect(store.status()).toBe('ready');
    expect(store.data()).toEqual(WEEK);
    expect(store.error()).toBeNull();
    expect(store.isEmpty()).toBe(false);
    expect(store.appliedTemplates()).toEqual(WEEK.appliedTemplates);
  });

  it('panels: seat 1 and seat 2, each with its own events over 7 days', () => {
    store.setWeek(WEEK_23);
    backend.expectOne(URL(WEEK_23)).flush(WEEK);

    const [left, right] = store.panels().map(member);
    expect([left.seat, left.name, left.layout.personId]).toEqual([1, 'Даулет', DAULET]);
    expect([right.seat, right.name, right.layout.personId]).toEqual([2, 'Айгерим', AIGERIM]);
    expect(left.layout.days.map((d) => d.date)[0]).toBe(WEEK_23);
    expect(left.layout.days).toHaveLength(7);
    // Monday: two work shifts of Daulet, nothing of Aigerim.
    expect(left.layout.days[0].boxes).toHaveLength(2);
    expect(right.layout.days[0].boxes).toHaveLength(0);
    // The joint dinner is in both panels.
    expect(left.layout.days[2].boxes).toHaveLength(1);
    expect(right.layout.days[2].boxes).toHaveLength(1);
  });

  it('«today» is counted in the zone of the week, not of the browser', () => {
    store.setWeek(WEEK_23);
    backend.expectOne(URL(WEEK_23)).flush(WEEK);
    const days = member(store.panels()[0]).layout.days;
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-11-25']);
    expect(store.today()).toBe('2026-11-25');
    expect(store.timeZone()).toBe('Asia/Almaty');
  });

  it('one member → the panel of seat 2 is a placeholder', () => {
    store.setWeek(WEEK_23);
    backend.expectOne(URL(WEEK_23)).flush({ ...WEEK, members: [WEEK.members[0]] });

    const [left, right] = store.panels();
    expect(member(left).name).toBe('Даулет');
    expect(right).toEqual({ kind: 'placeholder', seat: 2 });
  });

  it('a week without events is empty; with events — not', () => {
    store.setWeek(WEEK_23);
    expect(store.isEmpty()).toBe(false); // still loading
    backend.expectOne(URL(WEEK_23)).flush(emptyWeek(WEEK_23));
    expect(store.isEmpty()).toBe(true);
    expect(member(store.panels()[0]).layout.days.every((d) => d.boxes.length === 0)).toBe(true);
  });

  it('fast switching: the earlier request is cancelled, only the last answer is taken', () => {
    store.setWeek(WEEK_16);
    const first = backend.expectOne(URL(WEEK_16));
    store.setWeek(WEEK_23);
    expect(first.cancelled).toBe(true);
    backend.expectOne(URL(WEEK_23)).flush(WEEK);

    expect(store.data()?.weekStart).toBe(WEEK_23);
    expect(store.status()).toBe('ready');
    expect(store.periodLabel()).toBe('23 – 29 ноября 2026');
  });

  it('the previous week stays on screen while the next one loads', () => {
    store.setWeek(WEEK_23);
    backend.expectOne(URL(WEEK_23)).flush(WEEK);

    store.setWeek(WEEK_16);
    expect(store.status()).toBe('loading');
    expect(store.data()?.weekStart).toBe(WEEK_23);
    expect(store.panels()).toHaveLength(2);
    expect(store.periodLabel()).toBe('16 – 22 ноября 2026');
    expect(store.isEmpty()).toBe(false);

    backend.expectOne(URL(WEEK_16)).flush(emptyWeek(WEEK_16));
    expect(store.data()?.weekStart).toBe(WEEK_16);
    expect(store.isEmpty()).toBe(true);
  });

  it('an error → status error with ApiError; the data of another week is dropped', () => {
    store.setWeek(WEEK_23);
    backend.expectOne(URL(WEEK_23)).flush(WEEK);

    store.setWeek(WEEK_16);
    backend.expectOne(URL(WEEK_16)).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('MALFORMED_REQUEST');
    expect(store.data()).toBeNull();
    expect(store.panels()).toEqual([]);
    expect(store.isEmpty()).toBe(false);
    expect(workspaceNotFound).not.toHaveBeenCalled();
  });

  it('an error on the reload of the same week keeps that week; a retry recovers', () => {
    store.setWeek(WEEK_23);
    backend.expectOne(URL(WEEK_23)).flush(WEEK);

    store.reload();
    backend.expectOne(URL(WEEK_23)).error(new ProgressEvent('error'));
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('NETWORK_ERROR');
    expect(store.data()).toEqual(WEEK);

    store.reload();
    expect(store.status()).toBe('loading');
    backend.expectOne(URL(WEEK_23)).flush(WEEK_TEMPLATE_DELETED);
    expect(store.status()).toBe('ready');
    expect(store.error()).toBeNull();
    expect(store.data()).toEqual(WEEK_TEMPLATE_DELETED);
  });

  it('an error that is not an ApiError becomes UNKNOWN', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), // no errorInterceptor: the raw HttpErrorResponse comes through
        provideHttpClientTesting(),
        WeekStore,
        { provide: WorkspaceRefresh, useValue: { workspaceNotFound } },
      ],
    });
    TestBed.inject(SessionStore).setWorkspace(WORKSPACE_FULL_PAIR);
    const raw = TestBed.inject(WeekStore);
    raw.setWeek(WEEK_23);
    TestBed.inject(HttpTestingController)
      .expectOne(URL(WEEK_23))
      .flush(null, { status: 500, statusText: 'Boom' });
    expect(raw.error()?.code).toBe('UNKNOWN');
  });

  it('404 WORKSPACE_NOT_FOUND → error and the common handler of WS-07', () => {
    store.setWeek(WEEK_23);
    backend
      .expectOne(URL(WEEK_23))
      .flush(PROBLEM_WORKSPACE_NOT_FOUND, { status: 404, statusText: 'Not Found' });
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('WORKSPACE_NOT_FOUND');
    expect(workspaceNotFound).toHaveBeenCalledTimes(1);
  });

  it('no workspace in the session → the same «not found» route, without a request', () => {
    session.setWorkspace(null);
    store.setWeek(WEEK_23);
    backend.expectNone(() => true);
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('WORKSPACE_NOT_FOUND');
    expect(workspaceNotFound).toHaveBeenCalledTimes(1);
  });

  it('eventsChanged → the same week is requested again', () => {
    store.setWeek(WEEK_23);
    backend.expectOne(URL(WEEK_23)).flush(WEEK);

    TestBed.inject(DataChanges).eventsChanged();
    expect(store.status()).toBe('loading');
    backend.expectOne(URL(WEEK_23)).flush(emptyWeek(WEEK_23));
    expect(store.isEmpty()).toBe(true);
  });

  it('eventsChanged before any week was asked for does nothing', () => {
    TestBed.inject(DataChanges).eventsChanged();
    backend.expectNone(() => true);
    expect(store.status()).toBe('idle');
  });

  it('templatesChanged does not touch the week', () => {
    store.setWeek(WEEK_23);
    backend.expectOne(URL(WEEK_23)).flush(WEEK);
    TestBed.inject(DataChanges).templatesChanged();
    backend.expectNone(() => true);
  });

  it('after destroy the store neither listens nor applies answers', () => {
    store.setWeek(WEEK_23);
    const pending = backend.expectOne(URL(WEEK_23));
    TestBed.resetTestingModule();
    expect(pending.cancelled).toBe(true);
  });
});
