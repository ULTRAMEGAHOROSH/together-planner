import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { IsoDate } from '@core/api/models/common.models';
import { DayChips } from './day-chips';

describe('tp-day-chips (WEEK-13)', () => {
  let fixture: ComponentFixture<DayChips>;
  let picked: IsoDate[];
  const chips = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

  async function render(selectedDay: IsoDate, today: IsoDate) {
    fixture = TestBed.createComponent(DayChips);
    fixture.componentRef.setInput('weekStart', '2026-11-09');
    fixture.componentRef.setInput('selectedDay', selectedDay);
    fixture.componentRef.setInput('today', today);
    picked = [];
    fixture.componentInstance.dayChange.subscribe((d) => picked.push(d));
    await fixture.whenStable();
  }

  it('seven chips «Пн 9»…«Вс 15»; the chosen one is pressed', async () => {
    await render('2026-11-11', '2026-11-12');
    expect(chips().map((c) => c.textContent?.trim())).toEqual([
      'Пн 9',
      'Вт 10',
      'Ср 11',
      'Чт 12',
      'Пт 13',
      'Сб 14',
      'Вс 15',
    ]);
    expect(chips().map((c) => c.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  it('today carries a dot while it is not the chosen one, and aria-current always', async () => {
    await render('2026-11-11', '2026-11-12');
    expect(chips().map((c) => c.querySelector('.dot') !== null)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(chips()[3].getAttribute('aria-current')).toBe('date');
    expect(chips()[2].getAttribute('aria-current')).toBeNull();

    await render('2026-11-12', '2026-11-12');
    expect(chips()[3].querySelector('.dot')).toBeNull();
    expect(chips()[3].getAttribute('aria-current')).toBe('date');
  });

  it('a click says which day was chosen', async () => {
    await render('2026-11-09', '2026-11-12');
    chips()[5].click();
    expect(picked).toEqual(['2026-11-14']);
  });

  it('the week of another day has no today', async () => {
    await render('2026-11-09', '2026-12-01');
    expect(chips().some((c) => c.querySelector('.dot'))).toBe(false);
  });
});
