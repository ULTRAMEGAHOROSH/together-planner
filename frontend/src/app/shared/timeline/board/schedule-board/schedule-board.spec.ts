import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { A, B } from '../../testing/event-builder';
import { buildPanelLayout } from '../../engine/panel-layout';
import type { BoardPanel, SlotClick } from '../board.models';
import { ScheduleBoard } from './schedule-board';

function panels(dayCount: 1 | 7): BoardPanel[] {
  const range = { firstDay: dayCount === 7 ? '2026-11-09' : '2026-11-12', dayCount };
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

  it('DoD: the only data input is `panels` (presentational, FD-59)', () => {
    const inputs = Object.keys(
      (ScheduleBoard as unknown as { ɵcmp: { inputs: object } }).ɵcmp.inputs,
    );
    expect(inputs).toEqual(['panels']);
  });
});
