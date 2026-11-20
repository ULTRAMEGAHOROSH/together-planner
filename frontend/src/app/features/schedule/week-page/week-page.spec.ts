import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { Location } from '@angular/common';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  AUTH_RESPONSE,
  PROBLEM_MALFORMED,
  PROBLEM_WORKSPACE_NOT_FOUND,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { CLOCK } from '@core/time/zone-clock';
import { EventEditor } from '@features/events';
import { ApplyTemplateEntry } from '@features/templates';
import { ScheduleBoard } from '@shared/timeline/board/schedule-board/schedule-board';
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

  it('no workspace in the session → «today» is counted in UTC, the common «not found» route runs', async () => {
    TestBed.inject(SessionStore).setWorkspace(null);
    await open('next-week');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/week/2026-11-09', { replaceUrl: true });
    await open('2026-11-23');
    // The store has no workspace: W2 is asked, there is none → onboarding.
    backend.expectOne('/api/v1/workspaces/current').flush(PROBLEM_WORKSPACE_NOT_FOUND, {
      status: 404,
      statusText: 'Not Found',
    });
    expect(navigate).toHaveBeenLastCalledWith('/onboarding');
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

  it('TPL-08: «Применить шаблон» of the toolbar and of the empty week open it for the shown week', async () => {
    const openForWeek = vi
      .spyOn(TestBed.inject(ApplyTemplateEntry), 'openForWeek')
      .mockImplementation(() => undefined);
    backend.expectOne(NOV_23).flush(emptyWeek('2026-11-23'));
    await settle();
    const buttons = Array.from(host().querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Применить шаблон',
    );
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => b.click());
    expect(openForWeek).toHaveBeenCalledTimes(2);
    expect(openForWeek).toHaveBeenNthCalledWith(1, '2026-11-23');
    expect(openForWeek).toHaveBeenNthCalledWith(2, '2026-11-23');
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

describe('WeekPage day mode (WEEK-13)', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let narrow: BehaviorSubject<BreakpointState>;
  const router = () => TestBed.inject(Router);
  const el = () => harness.routeNativeElement!;
  const q = (selector: string) => el().querySelector(selector);
  const qa = (selector: string) => Array.from(el().querySelectorAll<HTMLElement>(selector));
  const byName = (name: string) =>
    qa('button').find(
      (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
    )!;
  const switchTo = (label: string) =>
    qa('[role="radio"]')
      .find((r) => r.textContent?.trim() === label)!
      .click();
  const url = () => router().url;

  async function start(initialUrl: string, narrowScreen = false) {
    narrow = new BehaviorSubject<BreakpointState>({ matches: narrowScreen, breakpoints: {} });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [{ path: 'week/:weekStart', component: WeekPage }],
          withComponentInputBinding(),
        ),
        { provide: CLOCK, useValue: () => NOW },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => narrow, isMatched: () => narrow.value.matches },
        },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    backend = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(initialUrl);
    router().initialNavigation();
    await harness.fixture.whenStable();
  }

  async function loadWeek(weekStart: string) {
    backend.expectOne(URL(weekStart)).flush({ ...WEEK, weekStart });
    await harness.fixture.whenStable();
  }

  async function settle() {
    await harness.fixture.whenStable();
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('a week without a day and without a choice: «Неделя», no chips', async () => {
    await start('/week/2026-11-23');
    await loadWeek('2026-11-23');
    expect(qa('tp-day-chips')).toHaveLength(0);
    expect(qa('tp-person-panel:first-of-type tp-day-column')).toHaveLength(7);
    expect(byName('Следующая неделя')).toBeDefined();
  });

  it('?day= opens that day: one column per panel, chips, the day in the title; the week is not asked for again', async () => {
    await start('/week/2026-11-23?day=2026-11-25');
    await loadWeek('2026-11-23');
    expect(url()).toBe('/week/2026-11-23?day=2026-11-25');
    expect(q('h1')?.textContent).toBe('Среда, 25 ноября');
    expect(qa('tp-person-panel').map((p) => p.querySelectorAll('tp-day-column').length)).toEqual([
      1, 1,
    ]);
    expect(qa('tp-day-chips button')).toHaveLength(7);
    expect(qa('tp-day-chips [aria-pressed="true"]').map((c) => c.textContent?.trim())).toEqual([
      'Ср 25',
    ]);
    expect(byName('Следующий день')).toBeDefined();
  });

  it('a chip changes the day inside the week: the address follows, nothing is loaded', async () => {
    await start('/week/2026-11-23?day=2026-11-25');
    await loadWeek('2026-11-23');
    qa('tp-day-chips button')[0].click();
    await settle();
    expect(url()).toBe('/week/2026-11-23?day=2026-11-23');
    expect(q('h1')?.textContent).toBe('Понедельник, 23 ноября');
    backend.expectNone(() => true);
  });

  it('Sunday → «›» → the Monday of the next week: the address and the week change', async () => {
    await start('/week/2026-11-23?day=2026-11-29');
    await loadWeek('2026-11-23');
    byName('Следующий день').click();
    await settle();
    expect(url()).toBe('/week/2026-11-30?day=2026-11-30');
    // While the next week loads the board keeps the last day of the old one.
    expect(qa('tp-day-column')).toHaveLength(2);
    await loadWeek('2026-11-30');
    expect(q('h1')?.textContent).toBe('Понедельник, 30 ноября');
  });

  it('the switch: «День» opens today (this week) or the Monday (another), «Неделя» goes back; the choice is remembered', async () => {
    await start('/week/2026-11-09');
    await loadWeek('2026-11-09');
    switchTo('День');
    await settle();
    expect(url()).toBe('/week/2026-11-09?day=2026-11-12'); // Thursday 12.11 is today
    expect(localStorage.getItem('tp.week.view')).toBe('day');

    switchTo('Неделя');
    await settle();
    expect(url()).toBe('/week/2026-11-09');
    expect(localStorage.getItem('tp.week.view')).toBe('week');
    expect(qa('tp-day-chips')).toHaveLength(0);

    await harness.navigateByUrl('/week/2026-11-23');
    await loadWeek('2026-11-23');
    switchTo('День');
    await settle();
    expect(url()).toBe('/week/2026-11-23?day=2026-11-23');
  });

  it('FD-47: a remembered «День» opens a week without ?day in the day mode (today, or the Monday)', async () => {
    localStorage.setItem('tp.week.view', 'day');
    await start('/week/2026-11-09');
    await loadWeek('2026-11-09');
    expect(q('h1')?.textContent).toBe('Четверг, 12 ноября');
    expect(url()).toBe('/week/2026-11-09');

    await harness.navigateByUrl('/week/2026-11-16');
    await loadWeek('2026-11-16');
    expect(q('h1')?.textContent).toBe('Понедельник, 16 ноября');
    // «Неделя» in the switch brings the week back, also for the next visits.
    switchTo('Неделя');
    await settle();
    expect(qa('tp-day-chips')).toHaveLength(0);
    expect(localStorage.getItem('tp.week.view')).toBe('week');
  });

  it('a day header opens the day, the same header leads back to the week', async () => {
    await start('/week/2026-11-23');
    await loadWeek('2026-11-23');
    byName('Ср 25 — открыть день: среда, 25 ноября').click();
    await settle();
    expect(url()).toBe('/week/2026-11-23?day=2026-11-25');
    expect(localStorage.getItem('tp.week.view')).toBe('day');
    expect(qa('tp-person-panel').map((p) => p.querySelectorAll('tp-day-column').length)).toEqual([
      1, 1,
    ]);

    qa('tp-day-header button')[0].click();
    await settle();
    expect(url()).toBe('/week/2026-11-23');
    expect(localStorage.getItem('tp.week.view')).toBe('week');
    expect(qa('tp-person-panel').map((p) => p.querySelectorAll('tp-day-column').length)).toEqual([
      7, 7,
    ]);
  });

  it('a day that is not in the week is dropped from the address (replace, no history entry)', async () => {
    await start('/week/2026-11-09?day=2026-11-23');
    expect(url()).toBe('/week/2026-11-09');
    expect(qa('tp-day-chips')).toHaveLength(0);
  });

  it('ViewContext.focusDate follows the day, and is the Monday on a week', async () => {
    await start('/week/2026-11-23');
    expect(TestBed.inject(ViewContext).focusDate()).toBe('2026-11-23');
    await harness.navigateByUrl('/week/2026-11-23?day=2026-11-26');
    expect(TestBed.inject(ViewContext).focusDate()).toBe('2026-11-26');
  });

  it('ViewContext.focusDate on the current week is today, not its Monday (the header starts there)', async () => {
    await start('/week/2026-11-09');
    expect(TestBed.inject(ViewContext).focusDate()).toBe('2026-11-12');
  });

  describe('a click on an empty place (EVT-04)', () => {
    const [first, second] = WORKSPACE_FULL_PAIR.members;
    let openCreate: ReturnType<typeof vi.spyOn>;

    async function click(personId: string) {
      await start('/week/2026-11-23');
      await loadWeek('2026-11-23');
      openCreate = vi.spyOn(TestBed.inject(EventEditor), 'openCreate').mockReturnValue();
      const board = harness.fixture.debugElement.query(By.directive(ScheduleBoard));
      (board.componentInstance as ScheduleBoard).slotClick.emit({
        date: '2026-11-25',
        minute: 570,
        personId,
      });
    }

    it('opens a new event there for the person of that column', async () => {
      await click(second.userId);
      expect(openCreate).toHaveBeenCalledExactlyOnceWith({
        date: '2026-11-25',
        minute: 570,
        personSeat: 2,
      });
    });

    it('the first person is seat 1', async () => {
      await click(first.userId);
      expect(openCreate).toHaveBeenCalledExactlyOnceWith({
        date: '2026-11-25',
        minute: 570,
        personSeat: 1,
      });
    });

    describe('a click on a card', () => {
      let openEdit: ReturnType<typeof vi.spyOn>;

      function board() {
        const debug = harness.fixture.debugElement.query(By.directive(ScheduleBoard));
        return debug.componentInstance as ScheduleBoard;
      }

      it('opens the event of the week, with its version, for edit', async () => {
        await start('/week/2026-11-23');
        await loadWeek('2026-11-23');
        openEdit = vi.spyOn(TestBed.inject(EventEditor), 'openEdit').mockReturnValue();

        board().eventClick.emit(WEEK.events[0].id);

        expect(openEdit).toHaveBeenCalledExactlyOnceWith(WEEK.events[0]);
      });

      it('an id that is not in the week opens nothing', async () => {
        await start('/week/2026-11-23');
        await loadWeek('2026-11-23');
        openEdit = vi.spyOn(TestBed.inject(EventEditor), 'openEdit').mockReturnValue();

        board().eventClick.emit('gone');

        expect(openEdit).not.toHaveBeenCalled();
      });

      it('before the week has arrived there is nothing to open', async () => {
        await start('/week/2026-11-23');
        openEdit = vi.spyOn(TestBed.inject(EventEditor), 'openEdit').mockReturnValue();

        const page = harness.fixture.debugElement.query(By.directive(WeekPage));
        (page.componentInstance as unknown as { edit(id: string): void }).edit('x');

        expect(openEdit).not.toHaveBeenCalled();
      });
    });

    it('a column of nobody we know opens nothing', async () => {
      await click('a-stranger');
      expect(openCreate).not.toHaveBeenCalled();
    });
  });

  describe('below 820 px', () => {
    it('only «День»: today for the current week, no switch, the headers are labels', async () => {
      await start('/week/2026-11-09', true);
      await loadWeek('2026-11-09');
      expect(q('h1')?.textContent).toBe('Четверг, 12 ноября');
      expect(qa('[role="radio"]')).toHaveLength(0);
      expect(qa('tp-day-header button')).toHaveLength(0);
      expect(qa('tp-person-panel').map((p) => p.querySelectorAll('tp-day-column').length)).toEqual([
        1, 1,
      ]);
      expect(qa('tp-day-chips button')).toHaveLength(7);
      expect(url()).toBe('/week/2026-11-09'); // the address is not rewritten
    });

    it('another week: the day is its Monday; the screen narrowing or widening switches the mode', async () => {
      await start('/week/2026-11-23');
      await loadWeek('2026-11-23');
      expect(qa('tp-day-chips')).toHaveLength(0);

      narrow.next({ matches: true, breakpoints: {} });
      await settle();
      expect(q('h1')?.textContent).toBe('Понедельник, 23 ноября');
      expect(qa('[role="radio"]')).toHaveLength(0);

      narrow.next({ matches: false, breakpoints: {} });
      await settle();
      expect(qa('tp-day-chips')).toHaveLength(0);
      expect(qa('[role="radio"]')).toHaveLength(2);
      // Narrowing is not a choice of the user: nothing was remembered.
      expect(localStorage.getItem('tp.week.view')).toBeNull();
    });
  });
});
