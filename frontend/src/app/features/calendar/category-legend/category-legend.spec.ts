import { TestBed } from '@angular/core/testing';
import { EVENT_CATEGORIES } from '@core/api/models/enums';
import { CATEGORY_PALETTE } from '@shared/domain';
import { CategoryLegend } from './category-legend';

describe('CategoryLegend (CAL-04)', () => {
  const render = async () => {
    const fixture = TestBed.createComponent(CategoryLegend);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('the header and nine chips, one per category, in the order of the palette', async () => {
    const el = await render();
    expect(el.querySelector('h2')?.textContent).toBe('Категории');
    const chips = Array.from(el.querySelectorAll('.chip'));
    expect(chips).toHaveLength(9);
    expect(chips.map((c) => c.textContent?.trim())).toEqual(
      EVENT_CATEGORIES.map((key) => CATEGORY_PALETTE[key].label),
    );
    expect(chips.map((c) => c.textContent?.trim())).toEqual([
      'Работа',
      'Сон',
      'Еда',
      'Дорога',
      'Спорт',
      'Отдых',
      'Вместе',
      'Поездка',
      'Другое',
    ]);
  });

  it('each chip has the colors of its category (the same as a pill of the calendar)', async () => {
    const el = await render();
    const first = el.querySelector<HTMLElement>('.chip');
    // The browser normalises the colors, so they are compared through a probe element.
    const probe = document.createElement('span');
    probe.style.background = CATEGORY_PALETTE.WORK.bg;
    probe.style.color = CATEGORY_PALETTE.WORK.fg;
    expect(first?.style.background).toBe(probe.style.background);
    expect(first?.style.color).toBe(probe.style.color);
  });

  it('is a list for assistive technology', async () => {
    const el = await render();
    expect(el.querySelectorAll('ul > li')).toHaveLength(9);
  });
});
