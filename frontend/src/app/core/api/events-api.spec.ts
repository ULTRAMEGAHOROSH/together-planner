import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { EventsApi } from './events-api';
import type { EventRequest } from './models/event.models';
import {
  EVENT_CREATED_MANUAL,
  EVENT_UPCOMING_PAGE,
  EVENT_UPDATED,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from './models/testing/samples';

const WS = WORKSPACE_FULL_PAIR.id;
const EVENTS = `/api/v1/workspaces/${WS}/events`;
const ID = EVENT_CREATED_MANUAL.id;

const REQUEST: EventRequest = {
  title: EVENT_CREATED_MANUAL.title,
  description: null,
  start: EVENT_CREATED_MANUAL.start,
  end: EVENT_CREATED_MANUAL.end,
  participantIds: EVENT_CREATED_MANUAL.participantIds,
  category: EVENT_CREATED_MANUAL.category,
  color: null,
};

describe('EventsApi (E1–E6)', () => {
  let api: EventsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(EventsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Subscribes, checks the one request and answers it; returns what the caller got. */
  async function call<T>(
    request: Observable<T>,
    expected: { method: string; url: string; body: unknown; params?: Record<string, string> },
    response: object | null,
    status = 200,
  ): Promise<T> {
    const result = firstValueFrom(request);
    const req = backend.expectOne((r) => r.url === expected.url);
    expect(req.request.method).toBe(expected.method);
    expect(req.request.body).toEqual(expected.body);
    expect(req.request.headers.keys()).toEqual([]);
    expect(
      Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)])),
    ).toEqual(expected.params ?? {});
    req.flush(response, { status, statusText: 'OK' });
    return result;
  }

  it('E1 range: GET …/events?from=&to= (both days inclusive)', async () => {
    const result = await call(
      api.range(WS, '2026-11-23', '2026-11-29'),
      {
        method: 'GET',
        url: EVENTS,
        body: null,
        params: { from: '2026-11-23', to: '2026-11-29' },
      },
      WEEK.events,
    );
    expect(result).toEqual(WEEK.events);
  });

  it('E2 upcoming: GET …/events/upcoming?page=&size= (zero-based page)', async () => {
    const result = await call(
      api.upcoming(WS, 0, 20),
      { method: 'GET', url: `${EVENTS}/upcoming`, body: null, params: { page: '0', size: '20' } },
      EVENT_UPCOMING_PAGE,
    );
    expect(result).toEqual(EVENT_UPCOMING_PAGE);
  });

  it('E3 create: POST …/events with the request as is → the created event', async () => {
    const result = await call(
      api.create(WS, REQUEST),
      { method: 'POST', url: EVENTS, body: REQUEST },
      EVENT_CREATED_MANUAL,
      201,
    );
    expect(result).toEqual(EVENT_CREATED_MANUAL);
  });

  it('E4 get: GET …/events/{eventId}', async () => {
    const result = await call(
      api.get(WS, ID),
      { method: 'GET', url: `${EVENTS}/${ID}`, body: null },
      EVENT_CREATED_MANUAL,
    );
    expect(result).toEqual(EVENT_CREATED_MANUAL);
  });

  it('E5 update: PUT …/events/{eventId} with the version inside the body', async () => {
    const body = { ...REQUEST, title: EVENT_UPDATED.title, version: 0 };
    const result = await call(
      api.update(WS, ID, body),
      { method: 'PUT', url: `${EVENTS}/${ID}`, body },
      EVENT_UPDATED,
    );
    expect(result).toEqual(EVENT_UPDATED);
  });

  it('E6 delete: DELETE …/events/{eventId}?version= — the version is always there, also 0', async () => {
    await call(
      api.delete(WS, ID, 3),
      { method: 'DELETE', url: `${EVENTS}/${ID}`, body: null, params: { version: '3' } },
      null,
      204,
    );
    await call(
      api.delete(WS, ID, 0),
      { method: 'DELETE', url: `${EVENTS}/${ID}`, body: null, params: { version: '0' } },
      null,
      204,
    );
  });

  it('uses API_BASE_URL', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.example.test/v1' },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    await call(
      TestBed.inject(EventsApi).get(WS, ID),
      {
        method: 'GET',
        url: `https://api.example.test/v1/workspaces/${WS}/events/${ID}`,
        body: null,
      },
      EVENT_CREATED_MANUAL,
    );
  });

  it('errors are not handled here: the HTTP error reaches the caller', async () => {
    const result = firstValueFrom(api.get(WS, ID)).catch((error: unknown) => error);
    backend.expectOne(`${EVENTS}/${ID}`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await result).toMatchObject({ status: 404 });
  });
});
