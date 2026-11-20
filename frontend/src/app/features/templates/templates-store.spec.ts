import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { TEMPLATE_CHANGED_TEXT, TEMPLATE_DELETED_TEXT, TemplatesStore } from './templates-store';

const LIST = `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/templates`;
const ONE = `${LIST}/${TEMPLATE_CREATED.id}`;
const problem = (code: string, status: number) => ({
  type: 'about:blank',
  title: code,
  status,
  code,
});

describe('TemplatesStore (TPL-02)', () => {
  let store: TemplatesStore;
  let backend: HttpTestingController;
  let toast: ToastService;
  let changes: DataChanges;
  const workspaceNotFound = vi.fn();

  beforeEach(() => {
    workspaceNotFound.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        TemplatesStore,
        { provide: WorkspaceRefresh, useValue: { workspaceNotFound } },
      ],
    });
    store = TestBed.inject(TemplatesStore);
    backend = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    changes = TestBed.inject(DataChanges);
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
  });

  afterEach(() => backend.verify());

  function loaded(): void {
    store.load();
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
  }

  it('starts idle and loads T1 into the list', () => {
    expect(store.status()).toBe('idle');
    store.load();
    expect(store.status()).toBe('loading');
    backend.expectOne(LIST).flush([TEMPLATE_CREATED, TEMPLATE_WITH_LAST_APPLICATION]);
    expect(store.status()).toBe('ready');
    expect(store.templates()).toHaveLength(2);
  });

  it('reloads when templates changed, keeping the old list while it loads', () => {
    loaded();
    changes.templatesChanged();
    expect(store.status()).toBe('loading');
    expect(store.templates()).toHaveLength(1);
    backend.expectOne(LIST).flush([]);
    expect(store.templates()).toEqual([]);
  });

  it('a failed load keeps the old list and gives the error', () => {
    loaded();
    store.load();
    backend.expectOne(LIST).flush(problem('INTERNAL_ERROR', 500), { status: 500, statusText: 'x' });
    expect(store.status()).toBe('error');
    expect(store.error()).not.toBeNull();
    expect(store.templates()).toHaveLength(1);
  });

  it('a lost workspace is reported', () => {
    backend.verify();
    TestBed.inject(SessionStore).setWorkspace(null);
    store.load();
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('WORKSPACE_NOT_FOUND');
    expect(workspaceNotFound).toHaveBeenCalled();
  });

  it('remove: T5 with the version, a toast, and the list is read again', () => {
    loaded();
    const show = vi.spyOn(toast, 'show');
    store.remove({ ...TEMPLATE_CREATED, version: 4 });
    expect(store.deletingId()).toBe(TEMPLATE_CREATED.id);
    const req = backend.expectOne((r) => r.url === ONE);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('version')).toBe('4');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(store.deletingId()).toBeNull();
    expect(show).toHaveBeenCalledWith(TEMPLATE_DELETED_TEXT);
    backend.expectOne(LIST).flush([]);
    expect(store.templates()).toEqual([]);
  });

  it('remove: a second press while T5 runs does nothing', () => {
    loaded();
    store.remove(TEMPLATE_CREATED);
    store.remove(TEMPLATE_CREATED);
    backend.expectOne((r) => r.url === ONE).flush(null, { status: 204, statusText: 'x' });
    backend.expectOne(LIST).flush([]);
  });

  it('remove: 404 → «already deleted» and a reload', () => {
    loaded();
    const show = vi.spyOn(toast, 'show');
    store.remove(TEMPLATE_CREATED);
    backend
      .expectOne((r) => r.url === ONE)
      .flush(problem('TEMPLATE_NOT_FOUND', 404), { status: 404, statusText: 'x' });
    expect(show).toHaveBeenCalledWith(ERROR_MESSAGES.TEMPLATE_NOT_FOUND);
    backend.expectOne(LIST).flush([]);
    expect(store.deletingId()).toBeNull();
  });

  it('remove: 409 → the partner changed it: a message and a reload', () => {
    loaded();
    const show = vi.spyOn(toast, 'show');
    store.remove(TEMPLATE_CREATED);
    backend
      .expectOne((r) => r.url === ONE)
      .flush(problem('VERSION_CONFLICT', 409), { status: 409, statusText: 'x' });
    expect(show).toHaveBeenCalledWith(TEMPLATE_CHANGED_TEXT);
    backend.expectOne(LIST).flush([TEMPLATE_WITH_LAST_APPLICATION]);
    expect(store.templates()).toEqual([TEMPLATE_WITH_LAST_APPLICATION]);
  });

  it('remove: any other error is only a toast, no reload', () => {
    loaded();
    const error = vi.spyOn(toast, 'error');
    store.remove(TEMPLATE_CREATED);
    backend
      .expectOne((r) => r.url === ONE)
      .flush(problem('INTERNAL_ERROR', 500), { status: 500, statusText: 'x' });
    expect(error).toHaveBeenCalled();
    expect(store.deletingId()).toBeNull();
  });
});
