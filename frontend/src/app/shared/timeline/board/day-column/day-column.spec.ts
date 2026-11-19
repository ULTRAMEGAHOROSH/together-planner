import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { A } from '../../testing/event-builder';
import { buildPanelLayout } from '../../engine/panel-layout';
import type { DayColumnLayout } from '../../engine/model';
import type { SlotClick } from '../board.models';
import { DayColumn } from './day-column';

const WEEK = buildPanelLayout([], { firstDay: '2026-11-09', dayCount: 7 }, A, {
  today: '2026-11-12',
}).days;

describe('tp-day-column (WEEK-05)', () => {
  let fixture: ComponentFixture<DayColumn>;
  let clicks: SlotClick[];

  async function render(day: DayColumnLayout) {
    fixture = TestBed.createComponent(DayColumn);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('personId', A);
    fixture.componentRef.setInput('personName', 'Daulet');
    clicks = [];
    fixture.componentInstance.slotClick.subscribe((c) => clicks.push(c));
    await fixture.whenStable();
  }
  const host = () => fixture.nativeElement as HTMLElement;
  const slot = () => host().querySelector<HTMLButtonElement>('button.slot')!;

  it('the column is one button named after the member and the date (§8.3)', async () => {
    await render(WEEK[0]);
    expect(slot().type).toBe('button');
    expect(slot().getAttribute('aria-label')).toBe(
      'Создать событие для Daulet, понедельник, 9 ноября',
    );
  });

  it('a click at top = 9.5 h → slotClick {date, minute 570, personId}', async () => {
    await render(WEEK[0]);
    // jsdom has no layout: the column top is 0, so clientY is the offset in the column.
    slot().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientY: 9.5 * 40 }));
    slot().dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientY: 9.5 * 40 + 19 }),
    );
    expect(clicks).toEqual([
      { date: '2026-11-09', minute: 570, personId: A },
      { date: '2026-11-09', minute: 570, personId: A },
    ]);
  });

  it('Enter / Space (a click without a point) → 09:00', async () => {
    await render(WEEK[0]);
    slot().click();
    expect(clicks).toEqual([{ date: '2026-11-09', minute: 540, personId: A }]);
  });

  it('today and weekend backgrounds by the layout flags', async () => {
    await render(WEEK[3]);
    expect([host().classList.contains('today'), host().classList.contains('weekend')]).toEqual([
      true,
      false,
    ]);
    fixture.componentRef.setInput('day', WEEK[5]);
    await fixture.whenStable();
    expect([host().classList.contains('today'), host().classList.contains('weekend')]).toEqual([
      false,
      true,
    ]);
  });
});
