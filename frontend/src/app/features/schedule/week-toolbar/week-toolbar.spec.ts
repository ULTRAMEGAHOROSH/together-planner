import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { WEEK } from '@core/api/models/testing/samples';
import type { IsoDate } from '@core/api/models/common.models';
import { WeekToolbar } from './week-toolbar';

describe('tp-week-toolbar (WEEK-11)', () => {
  let fixture: ComponentFixture<WeekToolbar>;
  let changes: IsoDate[];
  const host = () => fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    Array.from(host().querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
    ) as HTMLButtonElement;

  async function render(weekStart: IsoDate, currentWeek = '2026-11-09') {
    fixture = TestBed.createComponent(WeekToolbar);
    fixture.componentRef.setInput('weekStart', weekStart);
    fixture.componentRef.setInput('currentWeek', currentWeek);
    changes = [];
    fixture.componentInstance.weekChange.subscribe((w) => changes.push(w));
    await fixture.whenStable();
  }

  it('NV-01: «›» from 2026-11-09 asks for 2026-11-16', async () => {
    await render('2026-11-09');
    button('Следующая неделя').click();
    expect(changes).toEqual(['2026-11-16']);
  });

  it('«‹» asks for the week before', async () => {
    await render('2026-11-09');
    button('Предыдущая неделя').click();
    expect(changes).toEqual(['2026-11-02']);
  });

  it('NV-02: «‹» across the new year, «›» across it the other way', async () => {
    await render('2026-01-05');
    button('Предыдущая неделя').click();
    expect(changes).toEqual(['2025-12-29']);

    await render('2025-12-29');
    button('Следующая неделя').click();
    expect(changes).toEqual(['2026-01-05']);
  });

  it('NV-03: «Сегодня» asks for the current week', async () => {
    await render('2026-11-23');
    button('Сегодня').click();
    expect(changes).toEqual(['2026-11-09']);
  });

  it('«Сегодня» is off on the current week and on again anywhere else', async () => {
    await render('2026-11-09');
    expect(button('Сегодня').disabled).toBe(true);
    fixture.componentRef.setInput('weekStart', '2026-11-16');
    await fixture.whenStable();
    expect(button('Сегодня').disabled).toBe(false);
  });

  it('the title is the period of the week', async () => {
    await render('2026-11-23');
    expect(host().querySelector('h1')?.textContent).toBe('23 – 29 ноября 2026');
  });

  it('NV-05: the subtitle says which week it is: this, next, last, further away', async () => {
    const sub = () => host().querySelector('.sub')?.textContent;
    await render('2026-11-09');
    expect(sub()).toBe('Эта неделя');
    await render('2026-11-16');
    expect(sub()).toBe('Следующая неделя');
    await render('2026-11-02');
    expect(sub()).toBe('Прошлая неделя');
    await render('2026-11-30');
    expect(sub()).toBe('Через 3 недели');
  });

  it('the subtitle names the templates of the week, each once', async () => {
    await render('2026-11-23');
    fixture.componentRef.setInput('appliedTemplates', WEEK.appliedTemplates); // the same one twice
    await fixture.whenStable();
    expect(host().querySelector('.sub')?.textContent).toBe(
      'Через 2 недели · шаблон «Обычная неделя»',
    );

    const other = { ...WEEK.appliedTemplates[0], templateName: 'Отпуск' };
    fixture.componentRef.setInput('appliedTemplates', [...WEEK.appliedTemplates, other]);
    await fixture.whenStable();
    expect(host().querySelector('.sub')?.textContent).toBe(
      'Через 2 недели · шаблон «Обычная неделя», «Отпуск»',
    );
  });

  it('«Неделя / День»: a two-way switch, «Неделя» to start with', async () => {
    await render('2026-11-09');
    const radios = Array.from(host().querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(radios.map((r) => [r.textContent?.trim(), r.getAttribute('aria-checked')])).toEqual([
      ['Неделя', 'true'],
      ['День', 'false'],
    ]);
    radios[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.view()).toBe('day');
  });
});
