import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CATEGORY_PALETTE } from '@shared/domain/category-palette';
import { A, B, ev } from '../../testing/event-builder';
import { buildPanelLayout } from '../../engine/panel-layout';
import type { DayRange, EventBox, TimelineEvent } from '../../engine/model';
import { EventCard } from './event-card';

const MONDAY: DayRange = { firstDay: '2026-11-09', dayCount: 1 };
const FRIDAY: DayRange = { firstDay: '2026-11-13', dayCount: 1 };

/** The boxes of one day of A's panel, as the engine makes them. */
const boxes = (events: TimelineEvent[], range = MONDAY) =>
  buildPanelLayout(events, range, A, { today: null }).days[0].boxes;
const monday = (from: string, to: string, overrides: Partial<TimelineEvent> = {}, who = [A]) =>
  ev(`2026-11-09T${from}`, `2026-11-09T${to}`, who, overrides);

describe('tp-event-card (WEEK-06)', () => {
  let fixture: ComponentFixture<EventCard>;
  const host = () => fixture.nativeElement as HTMLElement;
  const button = () => host().querySelector<HTMLButtonElement>('button')!;
  const text = (selector: string) => host().querySelector(selector)?.textContent;

  async function render(box: EventBox) {
    fixture = TestBed.createComponent(EventCard);
    fixture.componentRef.setInput('box', box);
    await fixture.whenStable();
  }

  it('position and size come from the box: top, height, lane as % of the column', async () => {
    const [first, second, third] = boxes([
      monday('09:00', '10:00', { id: 'a' }),
      monday('09:00', '10:00', { id: 'b' }),
      monday('09:00', '10:00', { id: 'c' }),
    ]);
    await render(second);
    expect(host().style.top).toBe('361px');
    expect(host().style.height).toBe('38px');
    // The 2 px gutters of the prototype: `calc(L% + 2px)` and `calc(W% - 4px)`.
    expect(host().style.left).toContain('33.333');
    expect(host().style.left).toContain('+ 2px');
    expect(host().style.width).toContain('33.333');
    expect(host().style.width).toContain('- 4px');
    await render(first);
    expect(host().style.left).toBe('calc(0% + 2px)');
    await render(third);
    expect(host().style.left).toContain('66.666');
  });

  it('colors of the palette as CSS variables; the font size of the box', async () => {
    const [sport] = boxes([monday('09:00', '10:00', { category: 'SPORT', color: 'TRIP' })]);
    await render(sport);
    const trip = CATEGORY_PALETTE.TRIP;
    expect(host().style.getPropertyValue('--ev-bg')).toBe(trip.bg);
    expect(host().style.getPropertyValue('--ev-fg')).toBe(trip.fg);
    expect(host().style.getPropertyValue('--ev-dot')).toBe(trip.dot);
    expect(host().style.fontSize).toBe('12px');
    const [tiny] = boxes([monday('09:00', '09:05')]);
    await render(tiny);
    expect(host().style.fontSize).toBe('10.5px');
  });

  it('radius 8, and 3 on the edge that continues into another day', async () => {
    const night = ev('2026-11-13T23:00', '2026-11-14T07:00', [A]);
    const [friday] = boxes([night], FRIDAY);
    await render(friday);
    expect(host().style.borderRadius).toBe('8px 8px 3px 3px');
    const [saturday] = boxes([night], { firstDay: '2026-11-14', dayCount: 1 });
    await render(saturday);
    expect(host().style.borderRadius).toBe('3px 3px 8px 8px');
    await render(boxes([monday('09:00', '10:00')])[0]);
    expect(host().style.borderRadius).toBe('8px 8px 8px 8px');
  });

  it('tall: the title and the time on two lines', async () => {
    const [box] = boxes([monday('09:00', '11:00', { title: 'Работа' })]);
    await render(box);
    expect(host().classList).toContain('tall');
    expect(text('.title')).toBe('Работа');
    expect(text('.time')).toBe('09:00–11:00');
    expect(host().querySelector('.line')).toBeNull();
  });

  it('short and tiny: the title and the time in one line', async () => {
    for (const [from, to] of [
      ['09:00', '09:45'], // short
      ['09:00', '09:15'], // tiny
    ]) {
      await render(boxes([monday(from, to, { title: 'Кофе' })])[0]);
      expect(host().classList).not.toContain('tall');
      expect(host().querySelector('.head')).toBeNull();
      expect(text('.line')).toBe(`Кофе ${from}–${to}`);
    }
  });

  it('the «вместе» badge: only on a joint event, and only where there is room (tall)', async () => {
    await render(boxes([monday('09:00', '11:00', {}, [A, B])])[0]);
    expect(host().querySelector('.joint')).not.toBeNull();
    expect(host().querySelector('.joint')?.getAttribute('aria-hidden')).toBe('true');
    expect(host().querySelectorAll('.joint circle')).toHaveLength(2);

    await render(boxes([monday('09:00', '11:00')])[0]);
    expect(host().querySelector('.joint')).toBeNull();

    // A short joint card has no room for it; the name of the button still says «вместе».
    await render(boxes([monday('09:00', '09:45', {}, [A, B])])[0]);
    expect(host().querySelector('.joint')).toBeNull();
    expect(button().getAttribute('aria-label')).toContain('вместе');
  });

  it('a button named by the box: title, date, time, «вместе»', async () => {
    const [joint] = boxes([monday('19:00', '21:00', { title: 'Ужин' }, [A, B])]);
    await render(joint);
    expect(button().type).toBe('button');
    expect(button().getAttribute('aria-label')).toBe('Ужин, Пн, 9 нояб. · 19:00–21:00, вместе');
    await render(boxes([monday('19:00', '21:00', { title: 'Ужин' })])[0]);
    expect(button().getAttribute('aria-label')).toBe('Ужин, Пн, 9 нояб. · 19:00–21:00');
  });

  it('a click → eventClick(eventId); a long title is cut by the layout, not rewritten', async () => {
    const title = 'Очень длинное название события, которое не помещается в карточку целиком';
    const [box] = boxes([monday('09:00', '11:00', { id: 'long', title })]);
    await render(box);
    const clicked: string[] = [];
    fixture.componentInstance.eventClick.subscribe((id) => clicked.push(id));
    button().click();
    expect(clicked).toEqual(['long']);
    expect(text('.title')).toBe(title);
  });

  it('DoD: no computation — the only input is the box', () => {
    const inputs = Object.keys((EventCard as unknown as { ɵcmp: { inputs: object } }).ɵcmp.inputs);
    expect(inputs).toEqual(['box']);
  });
});
