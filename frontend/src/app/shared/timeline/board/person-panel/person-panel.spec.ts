import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { B, ev } from '../../testing/event-builder';
import { buildPanelLayout } from '../../engine/panel-layout';
import type { BoardPanel, SlotClick } from '../board.models';
import { PersonPanel } from './person-panel';

const panel = (dayCount: 1 | 7): BoardPanel => ({
  name: 'Партнёр',
  seat: 2,
  layout: buildPanelLayout([], { firstDay: '2026-11-09', dayCount }, B, { today: '2026-11-12' }),
});

describe('tp-person-panel (WEEK-05)', () => {
  let fixture: ComponentFixture<PersonPanel>;
  const host = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(PersonPanel);
    fixture.componentRef.setInput('panel', panel(7));
    await fixture.whenStable();
  });

  it('a header with the member (avatar, name, seat stripe) and the 7 day headers', () => {
    const head = host().querySelector('.head')!;
    expect(head.querySelector('tp-avatar')?.textContent).toBe('П');
    expect(head.querySelector('tp-avatar')?.classList).toContain('seat-2');
    expect(head.querySelector('.name')?.textContent).toBe('Партнёр');
    expect(head.classList).toContain('seat-2');
    expect(
      Array.from(head.querySelectorAll('tp-day-header')).map((h) => h.textContent?.trim()),
    ).toEqual(['Пн 9', 'Вт 10', 'Ср 11', 'Чт 12', 'Пт 13', 'Сб 14', 'Вс 15']);
    expect(host().getAttribute('role')).toBe('group');
    expect(host().getAttribute('aria-label')).toBe('Партнёр');
  });

  it('7 day columns under the header; the column count drives the grid', async () => {
    expect(host().querySelectorAll('tp-day-column')).toHaveLength(7);
    expect(host().style.getPropertyValue('--days')).toBe('7');
    fixture.componentRef.setInput('panel', panel(1));
    await fixture.whenStable();
    expect(host().querySelectorAll('tp-day-column')).toHaveLength(1);
    expect(host().style.getPropertyValue('--days')).toBe('1');
  });

  it('the cards of the member sit in their day columns; a card click comes out', () => {
    fixture.componentRef.setInput('panel', {
      ...panel(7),
      layout: buildPanelLayout(
        [ev('2026-11-11T10:00', '2026-11-11T12:00', [B], { id: 'wed', title: 'Врач' })],
        { firstDay: '2026-11-09', dayCount: 7 },
        B,
        { today: null },
      ),
    });
    fixture.detectChanges();
    const columns = Array.from(host().querySelectorAll('tp-day-column'));
    expect(columns.map((c) => c.querySelectorAll('tp-event-card').length)).toEqual([
      0, 0, 1, 0, 0, 0, 0,
    ]);
    const opened: string[] = [];
    fixture.componentInstance.eventClick.subscribe((id) => opened.push(id));
    columns[2].querySelector<HTMLButtonElement>('tp-event-card button')!.click();
    expect(opened).toEqual(['wed']);
  });

  it('a slot click of a column comes out with the member of the panel', () => {
    const clicks: SlotClick[] = [];
    fixture.componentInstance.slotClick.subscribe((c) => clicks.push(c));
    host().querySelectorAll<HTMLButtonElement>('tp-day-column .slot')[4].click();
    expect(clicks).toEqual([{ date: '2026-11-13', minute: 540, personId: B }]);
  });
});
