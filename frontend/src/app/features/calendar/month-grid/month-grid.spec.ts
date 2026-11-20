import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EVENT_CREATED_MANUAL } from '@core/api/models/testing/samples';
import type { EventResponse } from '@core/api/models/event.models';
import type { CalendarDay } from '../calendar-store';
import { MonthGrid } from './month-grid';

const manual = (id: string, over: Partial<EventResponse> = {}): EventResponse => ({
  ...EVENT_CREATED_MANUAL,
  id,
  title: `Дело ${id}`,
  ...over,
});

const day = (date: string, over: Partial<CalendarDay> = {}): CalendarDay => ({
  date,
  number: Number(date.slice(8)),
  inMonth: true,
  isToday: false,
  manual: [],
  routine: 0,
  ...over,
});

@Component({
  imports: [MonthGrid],
  template: `<tp-month-grid
    [days]="days()"
    [narrow]="narrow()"
    (dayClick)="clicked.push($event)"
    (eventClick)="opened.push($event)"
  />`,
})
class Host {
  readonly days = signal<CalendarDay[]>([]);
  readonly narrow = signal(false);
  readonly clicked: string[] = [];
  readonly opened: string[] = [];
}

describe('MonthGrid (CAL-01)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const el = () => fixture.nativeElement as HTMLElement;
  const cells = () => Array.from(el().querySelectorAll<HTMLElement>('.cell'));
  const render = async (days: CalendarDay[]) => {
    host.days.set(days);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
  });

  it('the seven weekday headers, Monday first, and a cell per day', async () => {
    await render([day('2026-11-02'), day('2026-11-03')]);
    expect(Array.from(el().querySelectorAll('.weekdays span')).map((s) => s.textContent)).toEqual([
      'Пн',
      'Вт',
      'Ср',
      'Чт',
      'Пт',
      'Сб',
      'Вс',
    ]);
    expect(cells().map((c) => c.querySelector('.number')?.textContent)).toEqual(['2', '3']);
  });

  it('marks today and the days outside the month', async () => {
    await render([
      day('2026-10-31', { inMonth: false }),
      day('2026-11-25', { isToday: true }),
      day('2026-11-26'),
    ]);
    const [outside, today, plain] = cells();
    expect(outside.classList).toContain('outside');
    expect(today.classList).toContain('today');
    expect(today.querySelector('.open')?.getAttribute('aria-current')).toBe('date');
    expect(plain.classList).not.toContain('outside');
    expect(plain.classList).not.toContain('today');
    expect(plain.querySelector('.open')?.getAttribute('aria-current')).toBeNull();
  });

  it('the cell button says which week it opens, and a click gives the day', async () => {
    await render([day('2026-11-09')]);
    const open = el().querySelector<HTMLButtonElement>('.open');
    expect(open?.getAttribute('aria-label')).toBe('Открыть неделю: понедельник, 9 ноября');
    open?.click();
    expect(host.clicked).toEqual(['2026-11-09']);
  });

  it('pills: time and title in the colors of the category; a click gives the event, not the day', async () => {
    await render([day('2026-11-23', { manual: [manual('a', { category: 'SPORT' })] })]);
    const pill = el().querySelector<HTMLButtonElement>('.pill');
    expect(pill?.textContent?.trim()).toBe('09:00 Дело a');
    expect(pill?.style.color).not.toBe('');
    expect(pill?.style.background).not.toBe('');
    pill?.click();
    expect(host.opened).toEqual(['a']);
    expect(host.clicked).toEqual([]);
  });

  it('at most three pills, the rest as «+ ещё n»', async () => {
    const events = ['a', 'b', 'c', 'd', 'e'].map((id) => manual(id));
    await render([day('2026-11-23', { manual: events })]);
    expect(el().querySelectorAll('.pill')).toHaveLength(3);
    expect(el().querySelector('.more')?.textContent?.trim()).toBe('+ ещё 2');
  });

  it('exactly three events have no «+ ещё»', async () => {
    await render([day('2026-11-23', { manual: ['a', 'b', 'c'].map((id) => manual(id)) })]);
    expect(el().querySelectorAll('.pill')).toHaveLength(3);
    expect(el().querySelector('.more')).toBeNull();
  });

  it('template events are counted: «n из шаблона», nothing when there are none', async () => {
    await render([day('2026-11-23', { routine: 4 }), day('2026-11-24')]);
    const [withRoutine, without] = cells();
    expect(withRoutine.querySelector('.routine')?.textContent?.trim()).toBe('4 из шаблона');
    expect(without.querySelector('.routine')).toBeNull();
  });

  it('narrow: pills without the time, «+n» for the template events', async () => {
    host.narrow.set(true);
    await render([day('2026-11-23', { manual: [manual('a')], routine: 4 })]);
    expect(el().querySelector('.pill')?.textContent?.trim()).toBe('Дело a');
    expect(el().querySelector('.routine')?.textContent?.trim()).toBe('+4');
    expect(el().querySelector('.grid')?.classList).toContain('narrow');
  });
});
