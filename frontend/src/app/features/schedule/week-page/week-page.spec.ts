import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  AUTH_RESPONSE,
  PROBLEM_MALFORMED,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { CLOCK } from '@core/time/zone-clock';
import { ViewContext } from '@core/view/view-context';
import { WeekPage } from './week-page';

const URL = (date: string) => `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/week?date=${date}`;
// Thursday 12.11.2026 14:20 in Almaty: the current week starts on 09.11.
const NOW = Date.UTC(2026, 10, 12, 9, 20);

describe('WeekPage (WEEK-10)', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<WeekPage>;
  const view = () => TestBed.inject(ViewContext);
  const host = () => fixture.nativeElement as HTMLElement;

  async function open(weekStart?: string) {
    fixture = TestBed.createComponent(WeekPage);
    if (weekStart !== undefined) {
      fixture.componentRef.setInput('weekStart', weekStart);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  it('a Monday: S1 for that week, then both panels on the board with the zone of the week', async () => {
    await open('2026-11-23');
    expect(host().querySelector('tp-schedule-board')).toBeNull(); // nothing to draw yet
    backend.expectOne(URL('2026-11-23')).flush(WEEK);
    await fixture.whenStable();

    const names = Array.from(host().querySelectorAll('tp-person-panel .name')).map(
      (n) => n.textContent,
    );
    expect(names).toEqual(['Даулет', 'Айгерим']);
    expect(host().querySelector('tp-partner-placeholder')).toBeNull();
    expect(host().querySelectorAll('tp-event-card').length).toBeGreaterThan(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ViewContext.focusDate is the Monday of the week and is cleared when the page goes', async () => {
    await open('2026-11-23');
    backend.expectOne(URL('2026-11-23'));
    expect(view().focusDate()).toBe('2026-11-23');
    fixture.destroy();
    expect(view().focusDate()).toBeNull();
  });

  it('another week in the address → the store loads that one', async () => {
    await open('2026-11-23');
    backend.expectOne(URL('2026-11-23')).flush(WEEK);
    fixture.componentRef.setInput('weekStart', '2026-11-16');
    await fixture.whenStable();
    backend.expectOne(URL('2026-11-16'));
    expect(view().focusDate()).toBe('2026-11-16');
  });

  it('not a Monday → the address is replaced by the Monday of that week, nothing is loaded', async () => {
    await open('2026-11-25');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/week/2026-11-23', { replaceUrl: true });
    backend.expectNone(() => true);
    expect(view().focusDate()).toBeNull();
  });

  it('not a date → the address is replaced by the current week', async () => {
    await open('next-week');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/week/2026-11-09', { replaceUrl: true });
    backend.expectNone(() => true);
  });

  it('an impossible date (30 February) is not a date either', async () => {
    await open('2026-02-30');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/week/2026-11-09', { replaceUrl: true });
  });

  it('no weekStart yet → nothing happens', async () => {
    await open();
    expect(navigate).not.toHaveBeenCalled();
    backend.expectNone(() => true);
  });

  it('one member → the right half is the placeholder with the invite card', async () => {
    await open('2026-11-23');
    backend.expectOne(URL('2026-11-23')).flush({ ...WEEK, members: [WEEK.members[0]] });
    await fixture.whenStable();

    expect(host().querySelectorAll('tp-person-panel')).toHaveLength(1);
    const grid = host().querySelector('tp-schedule-board .grid')!;
    expect(Array.from(grid.children).map((c) => c.tagName.toLowerCase())).toEqual([
      'tp-person-panel',
      'tp-time-gutter',
      'tp-partner-placeholder',
    ]);
    expect(host().querySelector('tp-invite-card')).not.toBeNull();
  });
});

describe('WeekPage navigation (WEEK-11)', () => {
  let harness: RouterTestingHarness;
  const router = () => TestBed.inject(Router);
  const click = (label: string) =>
    Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find((b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label)!
      .click();

  /** The browser's «Back»: the mock platform answers with a popstate on a later tick. */
  async function goBack() {
    TestBed.inject(Location).back();
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [{ path: 'week/:weekStart', component: WeekPage }],
          withComponentInputBinding(),
        ),
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    harness = await RouterTestingHarness.create('/week/2026-11-09');
    // TestBed does not start the router's listening to the browser history; the app does.
    router().initialNavigation();
  });

  it('the toolbar shows the requested week at once, before the answer', () => {
    const el = harness.routeNativeElement!;
    expect(el.querySelector('h1')?.textContent).toBe('9 – 15 ноября 2026');
    expect(el.querySelector('.sub')?.textContent).toBe('Эта неделя');
  });

  it('NV-01: «Следующая неделя» goes to /week/2026-11-16', async () => {
    click('Следующая неделя');
    await harness.fixture.whenStable();
    expect(router().url).toBe('/week/2026-11-16');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      '16 – 22 ноября 2026',
    );
    expect(harness.routeNativeElement?.querySelector('.sub')?.textContent).toBe('Следующая неделя');
  });

  it('NV-03: «Сегодня» goes to the current week by CLOCK and is off there', async () => {
    await harness.navigateByUrl('/week/2026-12-14');
    click('Сегодня');
    await harness.fixture.whenStable();
    expect(router().url).toBe('/week/2026-11-09');
    const today = Array.from(harness.routeNativeElement!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Сегодня',
    );
    expect(today?.disabled).toBe(true);
  });

  it('NV-04: «Назад» of the browser returns to the previous week', async () => {
    click('Следующая неделя');
    await harness.fixture.whenStable();
    click('Следующая неделя');
    await harness.fixture.whenStable();
    expect(router().url).toBe('/week/2026-11-23');

    await goBack();
    expect(router().url).toBe('/week/2026-11-16');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      '16 – 22 ноября 2026',
    );
  });

  it('«День» can be chosen; the page keeps the choice across weeks (what it does: WEEK-13)', async () => {
    const day = () =>
      Array.from(
        harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
      )[1];
    day().click();
    await harness.fixture.whenStable();
    click('Следующая неделя');
    await harness.fixture.whenStable();
    expect(day().getAttribute('aria-checked')).toBe('true');
  });

  it('a redirected address (not a Monday) leaves no extra history entry', async () => {
    await harness.navigateByUrl('/week/2026-11-18');
    await harness.fixture.whenStable();
    expect(router().url).toBe('/week/2026-11-16');
    await goBack();
    expect(router().url).toBe('/week/2026-11-09');
  });
});

describe('WeekPage states (WEEK-12)', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<WeekPage>;
  const host = () => fixture.nativeElement as HTMLElement;
  const q = (selector: string) => host().querySelector(selector);
  const NOV_23 = URL('2026-11-23');
  const NOV_16 = URL('2026-11-16');
  const emptyWeek = (weekStart: string) => ({
    ...WEEK,
    weekStart,
    events: [],
    appliedTemplates: [],
  });

  async function settle() {
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WeekPage);
    fixture.componentRef.setInput('weekStart', '2026-11-23');
    await settle();
  });

  afterEach(() => backend.verify());

  it('the first load: the skeleton of the board, no strip, no banners; gone when the week arrives', async () => {
    expect(q('.skeleton')?.getAttribute('aria-label')).toBe('Загружаем неделю…');
    expect(q('tp-schedule-board')).toBeNull();
    expect(q('[role="progressbar"]')).toBeNull();
    expect(q('tp-empty-state')).toBeNull();
    expect(q('tp-error-state')).toBeNull();

    backend.expectOne(NOV_23).flush(WEEK);
    await settle();
    expect(q('.skeleton')).toBeNull();
    expect(q('tp-schedule-board')).not.toBeNull();
  });

  it('the next week: the old board stays, a thin strip shows above it, no skeleton', async () => {
    backend.expectOne(NOV_23).flush(WEEK);
    await settle();

    fixture.componentRef.setInput('weekStart', '2026-11-16');
    await settle();
    expect(q('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Загружаем неделю…');
    expect(q('tp-schedule-board')).not.toBeNull();
    expect(q('.skeleton')).toBeNull();

    backend.expectOne(NOV_16).flush(WEEK);
    await settle();
    expect(q('[role="progressbar"]')).toBeNull();
  });

  it('an empty week: the banner of the prototype over the board; a week with events: none', async () => {
    backend.expectOne(NOV_23).flush(emptyWeek('2026-11-23'));
    await settle();
    expect(q('tp-empty-state')?.textContent).toContain('На эту неделю пока ничего нет.');
    expect(q('tp-schedule-board')).not.toBeNull();

    fixture.componentRef.setInput('weekStart', '2026-11-16');
    await settle();
    expect(q('tp-empty-state')).toBeNull(); // not known for the week that is loading
    backend.expectOne(NOV_16).flush(WEEK);
    await settle();
    expect(q('tp-empty-state')).toBeNull();
  });

  it('an error: the message with «Повторить», no skeleton; a retry asks again and recovers', async () => {
    backend.expectOne(NOV_23).error(new ProgressEvent('error'));
    await settle();
    expect(q('.skeleton')).toBeNull();
    expect(q('tp-error-state')?.textContent).toContain(ERROR_MESSAGES.NETWORK_ERROR);
    expect(q('tp-empty-state')).toBeNull();

    (q('tp-error-state button') as HTMLButtonElement).click();
    await settle();
    expect(q('tp-error-state')).toBeNull();
    expect(q('.skeleton')).not.toBeNull(); // nothing on screen: the skeleton again
    backend.expectOne(NOV_23).flush(WEEK);
    await settle();
    expect(q('tp-error-state')).toBeNull();
    expect(q('tp-schedule-board')).not.toBeNull();
  });

  it('a failed reload of the same week keeps the board under the error', async () => {
    backend.expectOne(NOV_23).flush(WEEK);
    await settle();
    TestBed.inject(DataChanges).eventsChanged();
    backend.expectOne(NOV_23).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
    await settle();
    expect(q('tp-error-state')).not.toBeNull();
    expect(q('tp-schedule-board')).not.toBeNull();
  });

  it('another week that fails: the board of the old week is gone, only the error is shown', async () => {
    backend.expectOne(NOV_23).flush(WEEK);
    await settle();
    fixture.componentRef.setInput('weekStart', '2026-11-16');
    await settle();
    backend.expectOne(NOV_16).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
    await settle();
    expect(q('tp-error-state')).not.toBeNull();
    expect(q('tp-schedule-board')).toBeNull();
    expect(q('.skeleton')).toBeNull();
  });
});
