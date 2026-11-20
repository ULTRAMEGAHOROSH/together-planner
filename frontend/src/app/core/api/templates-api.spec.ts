import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { ApplyTemplateRequest, TemplateRequest } from './models/template.models';
import {
  APPLY_PREVIEW_MERGE,
  APPLY_PREVIEW_REPLACE,
  APPLY_RESULT_MERGE,
  APPLY_RESULT_REPLACE,
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WORKSPACE_FULL_PAIR,
} from './models/testing/samples';
import { TemplatesApi } from './templates-api';

const WS = WORKSPACE_FULL_PAIR.id;
const TEMPLATES = `/api/v1/workspaces/${WS}/templates`;
const ID = TEMPLATE_CREATED.id;

const REQUEST: TemplateRequest = {
  name: TEMPLATE_CREATED.name,
  description: null,
  events: TEMPLATE_CREATED.events.map((e) => ({ ...e, id: null })),
};

const APPLY_MERGE: ApplyTemplateRequest = {
  weekStart: '2026-11-23',
  mode: 'MERGE',
  includeManual: true,
  confirmedDeleteIds: null,
  confirmedRestoredIds: null,
};

describe('TemplatesApi (T1–T7)', () => {
  let api: TemplatesApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TemplatesApi);
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

  it('T1 list: GET …/templates', async () => {
    const list = [TEMPLATE_WITH_LAST_APPLICATION, TEMPLATE_CREATED];
    const result = await call(api.list(WS), { method: 'GET', url: TEMPLATES, body: null }, list);
    expect(result).toEqual(list);
  });

  it('T2 create: POST …/templates with the request as is → the created template', async () => {
    const result = await call(
      api.create(WS, REQUEST),
      { method: 'POST', url: TEMPLATES, body: REQUEST },
      TEMPLATE_CREATED,
      201,
    );
    expect(result).toEqual(TEMPLATE_CREATED);
  });

  it('T3 get: GET …/templates/{templateId}', async () => {
    const result = await call(
      api.get(WS, ID),
      { method: 'GET', url: `${TEMPLATES}/${ID}`, body: null },
      TEMPLATE_CREATED,
    );
    expect(result).toEqual(TEMPLATE_CREATED);
  });

  it('T4 update: PUT …/templates/{templateId} with the version inside the body, event ids kept', async () => {
    const body = {
      ...REQUEST,
      name: 'Другая неделя',
      events: TEMPLATE_CREATED.events,
      version: 0,
    };
    const result = await call(
      api.update(WS, ID, body),
      { method: 'PUT', url: `${TEMPLATES}/${ID}`, body },
      TEMPLATE_WITH_LAST_APPLICATION,
    );
    expect(result).toEqual(TEMPLATE_WITH_LAST_APPLICATION);
  });

  it('T5 delete: DELETE …/templates/{templateId}?version= — the version is always there, also 0', async () => {
    await call(
      api.delete(WS, ID, 3),
      { method: 'DELETE', url: `${TEMPLATES}/${ID}`, body: null, params: { version: '3' } },
      null,
      204,
    );
    await call(
      api.delete(WS, ID, 0),
      { method: 'DELETE', url: `${TEMPLATES}/${ID}`, body: null, params: { version: '0' } },
      null,
      204,
    );
  });

  it('T6 preview: POST …/templates/{templateId}/apply/preview', async () => {
    const result = await call(
      api.preview(WS, ID, APPLY_MERGE),
      { method: 'POST', url: `${TEMPLATES}/${ID}/apply/preview`, body: APPLY_MERGE },
      APPLY_PREVIEW_MERGE,
    );
    expect(result).toEqual(APPLY_PREVIEW_MERGE);
  });

  it('T7 apply: POST …/templates/{templateId}/apply → 200, MERGE without confirmed sets', async () => {
    const result = await call(
      api.apply(WS, ID, APPLY_MERGE),
      { method: 'POST', url: `${TEMPLATES}/${ID}/apply`, body: APPLY_MERGE },
      APPLY_RESULT_MERGE,
    );
    expect(result).toEqual(APPLY_RESULT_MERGE);
  });

  it('T7 apply REPLACE: the confirmed sets from the preview go to the body unchanged', async () => {
    const body: ApplyTemplateRequest = {
      weekStart: APPLY_PREVIEW_REPLACE.weekStart,
      mode: 'REPLACE',
      includeManual: false,
      confirmedDeleteIds: APPLY_PREVIEW_REPLACE.toDelete.map((e) => e.id),
      confirmedRestoredIds: APPLY_PREVIEW_REPLACE.restoredDeleted.map((e) => e.templateEventId),
    };
    const result = await call(
      api.apply(WS, ID, body),
      { method: 'POST', url: `${TEMPLATES}/${ID}/apply`, body },
      APPLY_RESULT_REPLACE,
    );
    expect(result).toEqual(APPLY_RESULT_REPLACE);
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
      TestBed.inject(TemplatesApi).get(WS, ID),
      {
        method: 'GET',
        url: `https://api.example.test/v1/workspaces/${WS}/templates/${ID}`,
        body: null,
      },
      TEMPLATE_CREATED,
    );
  });

  it('errors are not handled here: the HTTP error reaches the caller', async () => {
    const result = firstValueFrom(api.get(WS, ID)).catch((error: unknown) => error);
    backend.expectOne(`${TEMPLATES}/${ID}`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await result).toMatchObject({ status: 404 });
  });
});
