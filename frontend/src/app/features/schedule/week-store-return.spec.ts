import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AUTH_RESPONSE, WEEK, WORKSPACE_FULL_PAIR } from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { errorInterceptor } from '@core/error/error-interceptor';
import { CLOCK } from '@core/time/zone-clock';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { RETURN_REFRESH_MIN_MS, WeekStore } from './week-store';

const URL = `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/week?date=2026-11-23`;

describe('WeekStore: the tab comes back (WEEK-16)', () => {
  let store: WeekStore;
  let backend: HttpTestingController;
  let now: number;
  let dialogOpen: boolean;
  let visibility: DocumentVisibilityState;

  const visibilityChange = (state: DocumentVisibilityState) => {
    visibility = state;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    now = Date.UTC(2026, 10, 25, 9, 20);
    dialogOpen = false;
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        WeekStore,
        { provide: CLOCK, useValue: () => now },
        { provide: WorkspaceRefresh, useValue: { workspaceNotFound: vi.fn() } },
        { provide: DialogService, useValue: { hasOpen: () => dialogOpen } },
      ],
    });
    store = TestBed.inject(WeekStore);
    backend = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    store.setWeek('2026-11-23');
    backend.expectOne(URL).flush(WEEK);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  it('reloads the week when the tab becomes visible after the pause', () => {
    now += RETURN_REFRESH_MIN_MS;
    visibilityChange('visible');
    expect(store.status()).toBe('loading');
    expect(store.data()).not.toBeNull(); // the board stays while it loads
    backend.expectOne(URL).flush(WEEK);
    expect(store.status()).toBe('ready');
  });

  it('not more often than once in 30 s', () => {
    now += RETURN_REFRESH_MIN_MS - 1;
    visibilityChange('visible');
    backend.expectNone(URL);
    // An answer restarts the count.
    now += 1;
    visibilityChange('visible');
    backend.expectOne(URL).flush(WEEK);
    visibilityChange('visible');
    backend.expectNone(URL);
  });

  it('nothing happens when the tab is hidden', () => {
    now += RETURN_REFRESH_MIN_MS * 4;
    visibilityChange('hidden');
    backend.expectNone(URL);
  });

  it('nothing happens while a dialog is open (an edit in progress)', () => {
    now += RETURN_REFRESH_MIN_MS * 4;
    dialogOpen = true;
    visibilityChange('visible');
    backend.expectNone(URL);
    dialogOpen = false;
    visibilityChange('visible');
    backend.expectOne(URL).flush(WEEK);
  });

  it('nothing happens while a load is already running or after an error', () => {
    now += RETURN_REFRESH_MIN_MS * 4;
    store.reload(); // loading
    visibilityChange('visible');
    backend.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
    expect(store.status()).toBe('error');
    visibilityChange('visible');
    backend.expectNone(URL);
  });

  it('stops listening when the store is destroyed', () => {
    TestBed.resetTestingModule();
    now += RETURN_REFRESH_MIN_MS * 4;
    visibilityChange('visible');
    backend.expectNone(URL);
  });
});
