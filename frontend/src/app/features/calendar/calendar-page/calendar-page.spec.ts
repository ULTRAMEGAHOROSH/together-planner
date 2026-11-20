import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import {
  AUTH_RESPONSE,
  EVENT_CREATED_JOINT,
  EVENT_CREATED_MANUAL,
  PROBLEM_MALFORMED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { CLOCK } from '@core/time/zone-clock';
import { ViewContext } from '@core/view/view-context';
import { EventEditor } from '@features/events';
import { CalendarPage } from './calendar-page';

const URL = (from: string, to: string) =>
  `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/events?from=${from}&to=${to}`;
const NOVEMBER = URL('2026-10-26', '2026-12-06');
const DECEMBER = URL('2026-11-30', '2027-01-03');
// «Запланировано»: from today for 93 days, whatever month is on screen.
const UPCOMING = URL('2026-11-12', '2027-02-12');
// Thursday 12.11.2026 14:20 in Almaty: the current month is 2026-11.
const NOW = Date.UTC(2026, 10, 12, 9, 20);

describe('CalendarPage (CAL-01)', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<CalendarPage>;
  let narrow: BehaviorSubject<BreakpointState>;
  const view = () => TestBed.inject(ViewContext);
  const host = () => fixture.nativeElement as HTMLElement;
  const openEdit = vi.fn();
  const openCreate = vi.fn();

  async function open(month?: string) {
    fixture = TestBed.createComponent(CalendarPage);
    if (month !== undefined) {
      fixture.componentRef.setInput('month', month);
    }
    await fixture.whenStable();
  }

  beforeEach(() => {
    openEdit.mockClear();
    openCreate.mockClear();
    narrow = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CLOCK, useValue: () => NOW },
        { provide: EventEditor, useValue: { openEdit, openCreate } },
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
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  // Every page asks for «Запланировано» too; the tests that look at it flush it themselves.
  afterEach(() => {
    backend.match(UPCOMING);
    backend.verify();
  });

  const flushNovember = async () => {
    backend.expectOne(NOVEMBER).flush([EVENT_CREATED_MANUAL, EVENT_CREATED_JOINT]);
    await fixture.whenStable();
  };
  const buttons = (label: string) =>
    Array.from(host().querySelectorAll<HTMLButtonElement>('button')).filter(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );

  it('a month: E1 for the six weeks, then the title and 42 cells', async () => {
    await open('2026-11');
    expect(host().querySelector('tp-month-grid')).toBeNull(); // nothing to draw yet
    expect(host().querySelector('.main .skeleton')).not.toBeNull();
    await flushNovember();
    expect(host().querySelector('h1')?.textContent).toBe('Ноябрь 2026');
    expect(host().querySelectorAll('.cell')).toHaveLength(42);
    expect(host().querySelector('.main .skeleton')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the manual events as pills in their days', async () => {
    await open('2026-11');
    await flushNovember();
    const pills = Array.from(host().querySelectorAll('.pill')).map((p) => p.textContent?.trim());
    expect(pills).toEqual(['09:00 Работа', '19:00 Ужин вместе']);
  });

  it('no month in the address → replaced by the current one, nothing is loaded', async () => {
    await open();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/calendar?month=2026-11', {
      replaceUrl: true,
    });
    backend.expectNone((request) => request.urlWithParams !== UPCOMING);
    expect(view().focusDate()).toBeNull();
  });

  it.each(['soon', '2026-13', '2026-11-01'])(
    '«%s» is not a month → the current one',
    async (raw) => {
      await open(raw);
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/calendar?month=2026-11', {
        replaceUrl: true,
      });
    },
  );

  it('another month in the address → the store loads that one', async () => {
    await open('2026-11');
    await flushNovember();
    fixture.componentRef.setInput('month', '2026-12');
    await fixture.whenStable();
    backend.expectOne(DECEMBER).flush([]);
    await fixture.whenStable();
    expect(host().querySelector('h1')?.textContent).toBe('Декабрь 2026');
    expect(host().querySelectorAll('.cell')).toHaveLength(35);
  });

  it('arrows go one month back and forward, «Сегодня» to the current month', async () => {
    await open('2026-12');
    backend.expectOne(DECEMBER).flush([]);
    await fixture.whenStable();
    buttons('Предыдущий месяц')[0].click();
    expect(navigate).toHaveBeenLastCalledWith('/calendar?month=2026-11');
    buttons('Следующий месяц')[0].click();
    expect(navigate).toHaveBeenLastCalledWith('/calendar?month=2027-01');
    buttons('Сегодня')[0].click();
    expect(navigate).toHaveBeenLastCalledWith('/calendar?month=2026-11');
  });

  it('«Сегодня» is disabled on the current month', async () => {
    await open('2026-11');
    await flushNovember();
    expect(buttons('Сегодня')[0].disabled).toBe(true);
  });

  it('a cell leads to that day on its week (the «День» mode)', async () => {
    await open('2026-11');
    await flushNovember();
    const cell = host().querySelector<HTMLButtonElement>(
      '.open[aria-label="Открыть неделю: среда, 25 ноября"]',
    );
    cell?.click();
    expect(navigate).toHaveBeenLastCalledWith('/week/2026-11-23?day=2026-11-25');
  });

  it('a day on the first row of the grid belongs to the week of that Monday, in the old month', async () => {
    await open('2026-11');
    await flushNovember();
    host().querySelector<HTMLButtonElement>('.open')?.click(); // 26.10
    expect(navigate).toHaveBeenLastCalledWith('/week/2026-10-26?day=2026-10-26');
  });

  it('a pill opens the editor with the event as it came, and does not leave the page', async () => {
    await open('2026-11');
    await flushNovember();
    host().querySelector<HTMLButtonElement>('.pill')?.click();
    expect(openEdit).toHaveBeenCalledExactlyOnceWith(EVENT_CREATED_MANUAL);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ViewContext.focusDate: today in the current month, the 1st in another; cleared on leave', async () => {
    await open('2026-11');
    backend.expectOne(NOVEMBER);
    expect(view().focusDate()).toBe('2026-11-12');
    fixture.componentRef.setInput('month', '2026-12');
    await fixture.whenStable();
    backend.expectOne(DECEMBER);
    expect(view().focusDate()).toBe('2026-12-01');
    fixture.destroy();
    expect(view().focusDate()).toBeNull();
  });

  it('narrow: pills lose the time', async () => {
    narrow.next({ matches: true, breakpoints: {} });
    await open('2026-11');
    await flushNovember();
    expect(host().querySelector('.pill')?.textContent?.trim()).toBe('Работа');
  });

  describe('«Запланировано» (CAL-02)', () => {
    const rows = () => Array.from(host().querySelectorAll<HTMLElement>('tp-upcoming-list .row'));
    const openWith = async (events = [EVENT_CREATED_JOINT, EVENT_CREATED_MANUAL]) => {
      await open('2026-11');
      backend.expectOne(NOVEMBER).flush([]);
      backend.expectOne(UPCOMING).flush(events);
      await fixture.whenStable();
    };

    it('lists the nearest events next to the grid', async () => {
      await openWith();
      expect(host().querySelector('tp-upcoming-list h2')?.textContent).toBe('Запланировано');
      expect(rows().map((row) => row.querySelector('.title')?.textContent)).toEqual([
        'Ужин вместе',
        'Работа',
      ]);
    });

    it('is the same on every month: it does not ask again when the month changes', async () => {
      await openWith();
      fixture.componentRef.setInput('month', '2026-12');
      await fixture.whenStable();
      backend.expectOne(DECEMBER).flush([]);
      backend.expectNone(UPCOMING);
      expect(rows()).toHaveLength(2);
    });

    it('a row opens the editor with the event as it came', async () => {
      await openWith();
      rows()[0].click();
      expect(openEdit).toHaveBeenCalledExactlyOnceWith(EVENT_CREATED_JOINT);
    });

    it('«+ Запланировать на будущее»: in 21 days at 10:00, for both', async () => {
      await openWith([]);
      host().querySelector<HTMLButtonElement>('tp-upcoming-list .future')?.click();
      expect(openCreate).toHaveBeenCalledExactlyOnceWith({
        date: '2026-12-03',
        minute: 600,
        personSeat: 'both',
      });
    });

    it('alone in the workspace the new event is for the person themselves', async () => {
      TestBed.inject(SessionStore).setWorkspace({
        ...WORKSPACE_FULL_PAIR,
        members: [WORKSPACE_FULL_PAIR.members[0]],
      });
      await openWith([]);
      host().querySelector<HTMLButtonElement>('tp-upcoming-list .future')?.click();
      expect(openCreate).toHaveBeenCalledExactlyOnceWith({
        date: '2026-12-03',
        minute: 600,
        personSeat: 1,
      });
    });

    it('the legend of the categories stands under it', async () => {
      await openWith([]);
      const side = host().querySelector('aside');
      expect(Array.from(side?.children ?? []).map((c) => c.tagName.toLowerCase())).toEqual([
        'tp-upcoming-list',
        'tp-category-legend',
      ]);
      expect(host().querySelectorAll('tp-category-legend .chip')).toHaveLength(9);
    });

    it('its own error does not take the grid away', async () => {
      await open('2026-11');
      backend.expectOne(NOVEMBER).flush([]);
      backend.expectOne(UPCOMING).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
      await fixture.whenStable();
      expect(host().querySelector('tp-upcoming-list tp-error-state')).not.toBeNull();
      expect(host().querySelectorAll('.cell')).toHaveLength(42);
    });
  });

  it('an error: the message with «Повторить», and the retry asks again', async () => {
    await open('2026-11');
    backend.expectOne(NOVEMBER).flush(PROBLEM_MALFORMED, { status: 400, statusText: 'Bad' });
    await fixture.whenStable();
    expect(host().querySelector('tp-error-state')?.textContent).toContain(
      ERROR_MESSAGES.MALFORMED_REQUEST,
    );
    host().querySelector<HTMLButtonElement>('tp-error-state button')?.click();
    backend.expectOne(NOVEMBER).flush([]);
    await fixture.whenStable();
    expect(host().querySelector('tp-error-state')).toBeNull();
    expect(host().querySelectorAll('.cell')).toHaveLength(42);
  });
});
