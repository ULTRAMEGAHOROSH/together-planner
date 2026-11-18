import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { INVITE, WORKSPACE_CREATED, WORKSPACE_FULL_PAIR } from './models/testing/samples';
import { WorkspaceApi } from './workspace-api';

const WS = WORKSPACE_FULL_PAIR.id;

describe('WorkspaceApi (W1–W6)', () => {
  let api: WorkspaceApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(WorkspaceApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Subscribes, checks the one request and answers it; returns what the caller got. */
  async function call<T>(
    request: Observable<T>,
    expected: { method: string; url: string; body: unknown },
    response: object,
    status = 200,
  ): Promise<T> {
    const result = firstValueFrom(request);
    const req = backend.expectOne(expected.url);
    expect(req.request.method).toBe(expected.method);
    expect(req.request.body).toEqual(expected.body);
    expect(req.request.headers.keys()).toEqual([]);
    req.flush(response, { status, statusText: 'OK' });
    return result;
  }

  it('W1 create: POST /api/v1/workspaces with name and time zone', async () => {
    const body = { name: 'Мы', timeZone: 'Asia/Almaty' };
    const result = await call(
      api.create(body),
      { method: 'POST', url: '/api/v1/workspaces', body },
      WORKSPACE_CREATED,
      201,
    );
    expect(result).toEqual(WORKSPACE_CREATED);
  });

  it('W2 current: GET /api/v1/workspaces/current', async () => {
    const result = await call(
      api.current(),
      { method: 'GET', url: '/api/v1/workspaces/current', body: null },
      WORKSPACE_FULL_PAIR,
    );
    expect(result).toEqual(WORKSPACE_FULL_PAIR);
  });

  it('W3 update: PATCH /api/v1/workspaces/{wsId} with only the changed field', async () => {
    const body = { name: 'Дом' };
    const result = await call(
      api.update(WS, body),
      { method: 'PATCH', url: `/api/v1/workspaces/${WS}`, body },
      { ...WORKSPACE_FULL_PAIR, name: 'Дом' },
    );
    expect(result.name).toBe('Дом');
  });

  it('W4 members: GET /api/v1/workspaces/{wsId}/members', async () => {
    const result = await call(
      api.members(WS),
      { method: 'GET', url: `/api/v1/workspaces/${WS}/members`, body: null },
      WORKSPACE_FULL_PAIR.members,
    );
    expect(result).toEqual(WORKSPACE_FULL_PAIR.members);
  });

  it('W5 createInvite: POST /api/v1/workspaces/{wsId}/invites without a body', async () => {
    const result = await call(
      api.createInvite(WS),
      { method: 'POST', url: `/api/v1/workspaces/${WS}/invites`, body: null },
      INVITE,
      201,
    );
    expect(result).toEqual(INVITE);
  });

  it('W6 join: POST /api/v1/workspaces/join with the code as typed', async () => {
    const body = { code: 'acz9-axjn' };
    const result = await call(
      api.join(body),
      { method: 'POST', url: '/api/v1/workspaces/join', body },
      WORKSPACE_FULL_PAIR,
    );
    expect(result).toEqual(WORKSPACE_FULL_PAIR);
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
      TestBed.inject(WorkspaceApi).current(),
      { method: 'GET', url: 'https://api.example.test/v1/workspaces/current', body: null },
      WORKSPACE_FULL_PAIR,
    );
  });

  it('errors are not handled here: the HTTP error reaches the caller', async () => {
    const result = firstValueFrom(api.current()).catch((error: unknown) => error);
    backend
      .expectOne('/api/v1/workspaces/current')
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(await result).toMatchObject({ status: 404 });
  });
});
