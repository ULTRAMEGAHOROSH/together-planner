import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  APPLY_PREVIEW_MERGE,
  APPLY_PREVIEW_MERGE_AGAIN,
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { errorInterceptor } from '@core/error/error-interceptor';
import type { ApplyParams } from './apply-params';
import { ApplyPreviewStore, PREVIEW_DEBOUNCE_MS } from './apply-preview-store';

const URL = `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/templates/${TEMPLATE_CREATED.id}/apply/preview`;
const MERGE: ApplyParams = {
  templateId: TEMPLATE_CREATED.id,
  weekStart: '2026-11-23',
  mode: 'MERGE',
  includeManual: false,
};

describe('ApplyPreviewStore (TPL-06)', () => {
  let store: ApplyPreviewStore;
  let backend: HttpTestingController;
  const workspaceNotFound = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    workspaceNotFound.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        ApplyPreviewStore,
        { provide: WorkspaceRefresh, useValue: { workspaceNotFound } },
      ],
    });
    store = TestBed.inject(ApplyPreviewStore);
    backend = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  const wait = (ms = PREVIEW_DEBOUNCE_MS) => vi.advanceTimersByTimeAsync(ms);

  it('starts idle; with no template it stays idle and asks nothing', async () => {
    expect(store.status()).toBe('idle');
    store.request({ ...MERGE, templateId: null });
    await wait();
    expect(store.status()).toBe('idle');
    expect(store.preview()).toBeNull();
  });

  it('asks T6 after the pause with the request of the choice, and shows the plan', async () => {
    store.request(MERGE);
    expect(store.status()).toBe('loading');
    await wait(PREVIEW_DEBOUNCE_MS - 1);
    backend.expectNone(URL);
    await wait(1);
    const req = backend.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      weekStart: '2026-11-23',
      mode: 'MERGE',
      includeManual: false,
      confirmedDeleteIds: null,
      confirmedRestoredIds: null,
    });
    req.flush(APPLY_PREVIEW_MERGE);
    expect(store.status()).toBe('ready');
    expect(store.preview()).toEqual(APPLY_PREVIEW_MERGE);
    expect(store.error()).toBeNull();
  });

  it('a burst of changes makes one request, for the last choice', async () => {
    store.request(MERGE);
    await wait(50);
    store.request({ ...MERGE, mode: 'FILL' });
    await wait(50);
    store.request({ ...MERGE, mode: 'REPLACE', includeManual: true });
    await wait();
    const req = backend.expectOne(URL);
    expect(req.request.body).toMatchObject({ mode: 'REPLACE', includeManual: true });
    req.flush({ ...APPLY_PREVIEW_MERGE, mode: 'REPLACE' });
  });

  it('AP-01: a change of mode asks again, and the answer to the old request is ignored', async () => {
    store.request(MERGE);
    await wait();
    const old = backend.expectOne(URL);
    store.request({ ...MERGE, mode: 'FILL' });
    await wait();
    const fresh = backend.expectOne(URL);
    expect(fresh.request.body.mode).toBe('FILL');
    expect(old.cancelled).toBe(true);
    fresh.flush({ ...APPLY_PREVIEW_MERGE_AGAIN, mode: 'FILL' });
    expect(store.preview()?.mode).toBe('FILL');
    // The old request is cancelled, so no late answer can take the place of the new plan.
    expect(store.preview()?.mode).toBe('FILL');
    expect(store.status()).toBe('ready');
  });

  it('while the next plan loads the old one is kept for display, but the status is not ready', async () => {
    store.request(MERGE);
    await wait();
    backend.expectOne(URL).flush(APPLY_PREVIEW_MERGE);
    store.request({ ...MERGE, weekStart: '2026-11-30' });
    expect(store.status()).toBe('loading');
    expect(store.preview()).toEqual(APPLY_PREVIEW_MERGE);
    await wait();
    backend.expectOne(URL).flush({ ...APPLY_PREVIEW_MERGE, weekStart: '2026-11-30' });
    expect(store.status()).toBe('ready');
    expect(store.preview()?.weekStart).toBe('2026-11-30');
  });

  it('AP-06: 404 TEMPLATE_NOT_FOUND is an error, and no plan is left that could be applied', async () => {
    store.request(MERGE);
    await wait();
    backend.expectOne(URL).flush(APPLY_PREVIEW_MERGE);
    store.request({ ...MERGE, mode: 'FILL' });
    await wait();
    backend
      .expectOne(URL)
      .flush(
        { type: 'about:blank', title: 'x', status: 404, code: 'TEMPLATE_NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('TEMPLATE_NOT_FOUND');
    expect(store.preview()).toBeNull();
  });

  it('a good answer after an error clears the error', async () => {
    store.request(MERGE);
    await wait();
    backend.expectOne(URL).flush(null, { status: 500, statusText: 'x' });
    expect(store.status()).toBe('error');
    store.refresh(MERGE);
    await wait();
    backend.expectOne(URL).flush(APPLY_PREVIEW_MERGE);
    expect(store.status()).toBe('ready');
    expect(store.error()).toBeNull();
  });

  it('a lost workspace is reported', async () => {
    TestBed.inject(SessionStore).setWorkspace(null);
    store.request(MERGE);
    await wait();
    expect(store.error()?.code).toBe('WORKSPACE_NOT_FOUND');
    expect(workspaceNotFound).toHaveBeenCalled();
  });
});
