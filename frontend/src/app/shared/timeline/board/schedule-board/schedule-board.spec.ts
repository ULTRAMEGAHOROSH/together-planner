import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CLOCK } from '@core/time/zone-clock';
import { A, B, ev } from '../../testing/event-builder';
import { buildPanelLayout } from '../../engine/panel-layout';
import type { BoardPanel, SlotClick } from '../board.models';
import { ScheduleBoard } from './schedule-board';

function panels(
  dayCount: 1 | 7,
  firstDay = dayCount === 7 ? '2026-11-09' : '2026-11-12',
): BoardPanel[] {
  const range = { firstDay, dayCount };
  return [
    { name: 'Daulet', seat: 1, layout: buildPanelLayout([], range, A, { today: '2026-11-12' }) },
    { name: 'Партнёр', seat: 2, layout: buildPanelLayout([], range, B, { today: '2026-11-12' }) },
  ];
}

describe('tp-schedule-board (WEEK-05, FD-57…59)', () => {
  let fixture: ComponentFixture<ScheduleBoard>;
  let scrolledTo: number[];
  const host = () => fixture.nativeElement as HTMLElement;
  const grid = () => host().querySelector<HTMLElement>('.grid')!;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ScheduleBoard);
    // jsdom does not scroll: record what the board asks for.
    scrolledTo = [];
    Object.defineProperty(host(), 'scrollTop', {
      configurable: true,
      set: (value: number) => scrolledTo.push(value),
    });
    fixture.componentRef.setInput('panels', panels(7));
    await fixture.whenStable();
  });

  it('[panel A] [time] [panel B] in one grid, 7 columns in each panel, 23 hour labels', () => {
    expect(Array.from(grid().children).map((c) => c.tagName.toLowerCase())).toEqual([
      'tp-person-panel',
      'tp-time-gutter',
      'tp-person-panel',
    ]);
    const columns = Array.from(host().querySelectorAll('tp-person-panel')).map(
      (p) => p.querySelectorAll('tp-day-column').length,
    );
    expect(columns).toEqual([7, 7]);
    expect(host().querySelectorAll('tp-time-gutter .hour')).toHaveLength(23);
    expect(
      Array.from(host().querySelectorAll('tp-person-panel .name')).map((n) => n.textContent),
    ).toEqual(['Daulet', 'Партнёр']);
  });

  it('opens scrolled to 06:00 (once), the hour height comes from the engine', () => {
    expect(scrolledTo).toEqual([240]);
    expect(host().style.getPropertyValue('--board-hour')).toBe('40px');
  });

  it('«Неделя» keeps 1080 px and scrolls sideways; «День» fits the screen', async () => {
    expect(grid().style.minWidth).toBe('1080px');
    fixture.componentRef.setInput('panels', panels(1));
    await fixture.whenStable();
    expect(grid().style.minWidth).toBe('');
    expect(host().querySelectorAll('tp-day-column')).toHaveLength(2);
    expect(scrolledTo).toEqual([240]); // new data does not jump the scroll
  });

  it('slotClick from any panel reaches the board output', () => {
    const clicks: SlotClick[] = [];
    fixture.componentInstance.slotClick.subscribe((c) => clicks.push(c));
    const [a, b] = Array.from(host().querySelectorAll('tp-person-panel'));
    a.querySelectorAll<HTMLButtonElement>('.slot')[0].click();
    b.querySelectorAll<HTMLButtonElement>('.slot')[6].click();
    expect(clicks).toEqual([
      { date: '2026-11-09', minute: 540, personId: A },
      { date: '2026-11-15', minute: 540, personId: B },
    ]);
  });

  it('cards of both panels, a card click reaches the board output', async () => {
    const range = { firstDay: '2026-11-09', dayCount: 7 } as const;
    const events = [
      ev('2026-11-10T09:00', '2026-11-10T10:00', [A], { id: 'a-only' }),
      ev('2026-11-10T19:00', '2026-11-10T21:00', [A, B], { id: 'both' }),
    ];
    fixture.componentRef.setInput('panels', [
      { name: 'Daulet', seat: 1, layout: buildPanelLayout(events, range, A, { today: null }) },
      { name: 'Партнёр', seat: 2, layout: buildPanelLayout(events, range, B, { today: null }) },
    ]);
    await fixture.whenStable();
    const [a, b] = Array.from(host().querySelectorAll('tp-person-panel'));
    expect(a.querySelectorAll('tp-event-card')).toHaveLength(2);
    expect(b.querySelectorAll('tp-event-card')).toHaveLength(1); // the joint event: a copy per panel

    const opened: string[] = [];
    fixture.componentInstance.eventClick.subscribe((id) => opened.push(id));
    a.querySelector<HTMLButtonElement>('tp-event-card button')!.click();
    b.querySelector<HTMLButtonElement>('tp-event-card button')!.click();
    expect(opened).toEqual(['a-only', 'both']);
  });

  it('DoD: data only through inputs — the panels, the zone of «now» and the day headers mode (FD-59)', () => {
    const inputs = Object.keys(
      (ScheduleBoard as unknown as { ɵcmp: { inputs: object } }).ɵcmp.inputs,
    );
    expect(inputs).toEqual([
      'panels',
      'timeZone',
      'dayNavigation',
      'readOnly',
      'highlightedEventId',
    ]);
  });
});

describe('tp-schedule-board: the now line (WEEK-07, FD-33)', () => {
  const utc = (day: number, hour: number, minute: number, second = 0) =>
    Date.UTC(2026, 10, day, hour, minute, second);
  let instant: number;
  let fixture: ComponentFixture<ScheduleBoard>;
  const host = () => fixture.nativeElement as HTMLElement;
  const lines = () => Array.from(host().querySelectorAll<HTMLElement>('tp-now-indicator'));
  /** [panel, column index] of every line. */
  const places = () =>
    lines().map((line) => {
      const panel = line.closest('tp-person-panel')!;
      const column = line.closest('tp-day-column')!;
      return [
        panel.getAttribute('aria-label'),
        Array.from(panel.querySelectorAll('tp-day-column')).indexOf(column),
      ];
    });
  const label = () => host().querySelector<HTMLElement>('tp-time-gutter .now');

  function render(zone: string | null, boardPanels: BoardPanel[], at = utc(6, 9, 20)) {
    instant = at;
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: () => instant }] });
    fixture = TestBed.createComponent(ScheduleBoard);
    fixture.componentRef.setInput('panels', boardPanels);
    fixture.componentRef.setInput('timeZone', zone);
    fixture.detectChanges();
  }

  afterEach(() => vi.useRealTimers());

  it('fixed CLOCK 2026-11-06T09:20Z in Asia/Almaty → 14:20, only in the Fri 6 Nov column', () => {
    render('Asia/Almaty', panels(7, '2026-11-02'));
    // A line in the Friday column of each panel, one label in the gutter.
    expect(places()).toEqual([
      ['Daulet', 4],
      ['Партнёр', 4],
    ]);
    expect(lines().map((l) => l.style.top)).toEqual(['573px', '573px']);
    expect([label()?.textContent, label()?.style.top]).toEqual(['14:20', '573px']);
    expect(host().querySelectorAll('tp-time-gutter .now')).toHaveLength(1);
  });

  it('the same moment in another zone is another time, even another day', () => {
    render('Europe/Berlin', panels(7, '2026-11-02'));
    expect([label()?.textContent, label()?.style.top]).toEqual(['10:20', '413px']);
    TestBed.resetTestingModule();
    // 09:20Z is still Thursday 22:20 in Pacific/Pago_Pago (−11): the line is in Thursday's column.
    render('Pacific/Pago_Pago', panels(7, '2026-11-02'));
    expect(places()[0]).toEqual(['Daulet', 3]);
    expect(label()?.textContent).toBe('22:20');
  });

  it('no zone (template preview) → no line, no label', () => {
    render(null, panels(7, '2026-11-02'));
    expect(lines()).toHaveLength(0);
    expect(label()).toBeNull();
  });

  it('today is not among the displayed days → no line, no label', () => {
    render('Asia/Almaty', panels(7, '2026-11-09'));
    expect(lines()).toHaveLength(0);
    expect(label()).toBeNull();
  });

  it('«День»: the line in the day of today, nothing on another day', () => {
    render('Asia/Almaty', panels(1, '2026-11-06'));
    expect(places()).toEqual([
      ['Daulet', 0],
      ['Партнёр', 0],
    ]);
    fixture.componentRef.setInput('panels', panels(1, '2026-11-07'));
    fixture.detectChanges();
    expect(lines()).toHaveLength(0);
    expect(label()).toBeNull();
  });

  describe('once a minute, without redrawing the rest', () => {
    beforeEach(() => vi.useFakeTimers());

    it('moves on the minute boundary only; the elements stay', () => {
      render('Asia/Almaty', panels(7, '2026-11-02'), utc(6, 9, 20, 30));
      const [line] = lines();
      const text = label()!;
      expect([line.style.top, text.textContent]).toEqual(['573px', '14:20']);

      instant = utc(6, 9, 20, 59);
      vi.advanceTimersByTime(29_000); // 09:20:59, still before the boundary
      fixture.detectChanges();
      expect([line.style.top, text.textContent]).toEqual(['573px', '14:20']);

      instant = utc(6, 9, 21);
      vi.advanceTimersByTime(30_000);
      fixture.detectChanges();
      expect([line.style.top, text.textContent]).toEqual(['574px', '14:21']);
      // The same nodes, updated in place.
      expect(lines()[0]).toBe(line);
      expect(label()).toBe(text);
      expect(vi.getTimerCount()).toBe(1);
    });

    it('crosses midnight: the line goes to the next column, the label to 00:00', () => {
      // 18:59:30Z = Fri 23:59:30 in Almaty.
      render('Asia/Almaty', panels(7, '2026-11-02'), utc(6, 18, 59, 30));
      expect(places()[0]).toEqual(['Daulet', 4]);
      expect(label()?.textContent).toBe('23:59');

      instant = utc(6, 19, 0);
      vi.advanceTimersByTime(30_000);
      fixture.detectChanges();
      expect(places()).toEqual([
        ['Daulet', 5],
        ['Партнёр', 5],
      ]);
      expect([label()?.textContent, label()?.style.top]).toEqual(['00:00', '0px']);
    });

    it('the last day of the board is over → the line is gone', () => {
      // Sun 8 Nov 23:59:30 in Almaty; the board shows 2–8 Nov; a minute later it is Monday.
      render('Asia/Almaty', panels(7, '2026-11-02'), utc(8, 18, 59, 30));
      expect(places()[0]).toEqual(['Daulet', 6]);
      instant = utc(8, 19, 0);
      vi.advanceTimersByTime(30_000);
      fixture.detectChanges();
      expect(lines()).toHaveLength(0);
      expect(label()).toBeNull();
    });
  });
});

describe('tp-schedule-board day headers (WEEK-13)', () => {
  it('plain labels by default; with dayNavigation buttons that say which day was chosen', async () => {
    const fixture = TestBed.createComponent(ScheduleBoard);
    fixture.componentRef.setInput('panels', panels(7));
    const chosen: string[] = [];
    fixture.componentInstance.dayClick.subscribe((d) => chosen.push(d));
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('tp-day-header button')).toHaveLength(0);

    fixture.componentRef.setInput('dayNavigation', true);
    await fixture.whenStable();
    const buttons = host.querySelectorAll<HTMLButtonElement>('tp-day-header button');
    expect(buttons).toHaveLength(14);
    buttons[2].click();
    expect(chosen).toEqual(['2026-11-11']);
  });

  it('on one open day the headers lead back to the week', async () => {
    const fixture = TestBed.createComponent(ScheduleBoard);
    fixture.componentRef.setInput('panels', panels(1));
    fixture.componentRef.setInput('dayNavigation', true);
    await fixture.whenStable();
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tp-day-header button'),
    ).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Чт 12 — вернуться к неделе', 'Чт 12 — вернуться к неделе']);
  });
});

describe('tp-schedule-board with one panel (WEEK-10)', () => {
  @Component({
    imports: [ScheduleBoard],
    template: `
      <tp-schedule-board [panels]="panels">
        <p tpPartnerPlaceholder>Пригласите партнёра</p>
      </tp-schedule-board>
    `,
  })
  class Host {
    readonly panels = panels(7).slice(0, 1);
  }

  it('[panel] [time] [placeholder]: the marked content takes the right half', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const grid = (fixture.nativeElement as HTMLElement).querySelector('.grid')!;
    expect(Array.from(grid.children).map((c) => c.tagName.toLowerCase())).toEqual([
      'tp-person-panel',
      'tp-time-gutter',
      'p',
    ]);
    expect(grid.lastElementChild?.textContent).toBe('Пригласите партнёра');
  });

  it('two panels: the marked content is not shown', async () => {
    @Component({
      imports: [ScheduleBoard],
      template: `
        <tp-schedule-board [panels]="panels"><p tpPartnerPlaceholder>скрыто</p></tp-schedule-board>
      `,
    })
    class Pair {
      readonly panels = panels(7);
    }
    const fixture = TestBed.createComponent(Pair);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('скрыто');
  });
});

describe('tp-schedule-board: one event in two panels (WEEK-14)', () => {
  const joint = ev('2026-11-12T19:00', '2026-11-12T21:00', [A, B], { id: 'both', title: 'Вместе' });
  const solo = ev('2026-11-12T10:00', '2026-11-12T11:00', [A], { id: 'solo', title: 'Один' });
  const range = { firstDay: '2026-11-12', dayCount: 1 } as const;
  let fixture: ComponentFixture<ScheduleBoard>;
  const cards = () =>
    Array.from(fixture.nativeElement.querySelectorAll('tp-event-card')) as HTMLElement[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(ScheduleBoard);
    fixture.componentRef.setInput('panels', [
      {
        name: 'Daulet',
        seat: 1,
        layout: buildPanelLayout([joint, solo], range, A, { today: null }),
      },
      {
        name: 'Партнёр',
        seat: 2,
        layout: buildPanelLayout([joint, solo], range, B, { today: null }),
      },
    ]);
    await fixture.whenStable();
  });

  it('hover on the copy in panel A is reported; the highlighted id rings the copy in panel B too', async () => {
    const heard: unknown[] = [];
    fixture.componentInstance.eventHover.subscribe((h) => heard.push(h));
    expect(cards()).toHaveLength(3); // two copies of the joint event and the solo one
    const copyInA = cards()[1];
    copyInA.dispatchEvent(new MouseEvent('mouseenter'));
    expect(heard).toEqual([{ eventId: 'both', anchor: copyInA }]);

    fixture.componentRef.setInput('highlightedEventId', 'both');
    await fixture.whenStable();
    const ringed = cards().map((c) => c.classList.contains('highlighted'));
    expect(ringed.filter(Boolean)).toHaveLength(2); // both copies, not the solo event
    const titles = cards()
      .filter((c) => c.classList.contains('highlighted'))
      .map((c) => c.textContent);
    expect(titles.every((t) => t?.includes('Вместе'))).toBe(true);
  });
});
